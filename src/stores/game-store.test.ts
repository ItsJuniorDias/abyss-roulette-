import { describe, expect, it, vi } from 'vitest';
import { createGameStore } from './game-store.ts';
import { createDemoRoulette } from '../adapters/demo-roulette.ts';
import { createLocalGameStorage } from '../adapters/local-game-storage.ts';
import { ORDER } from '../config/roulette.ts';
import type { RoulettePort, RoundOutcome, SavedGame } from '../interfaces/roulette-session.ts';

function memoryStorage() {
  const data = new Map<string, string>();
  return createLocalGameStorage({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  });
}
function session(port: RoulettePort = createDemoRoulette(() => ORDER.indexOf(1))) {
  const storage = memoryStorage();
  const store = createGameStore(port, storage);
  store.getState().setRendererReady(true);
  return { store, storage };
}

describe('round lifecycle', () => {
  it('reserves chips, settles once, and ignores stale presentation checkpoints', async () => {
    const { store } = session();
    store.getState().placeBet('red');
    expect(store.getState().balance).toBe(995);
    await store.getState().requestSpin();
    const round = store.getState().round!;
    expect(store.getState().phase).toBe('spin');
    store.getState().finishSpin('stale');
    expect(store.getState().balance).toBe(995);
    store.getState().finishSpin(round.id);
    store.getState().finishSpin(round.id);
    expect(store.getState()).toMatchObject({
      phase: 'result',
      balance: 1005,
      history: [1],
      bets: {},
      lastBets: { red: 5 },
    });
    store.getState().finishResult('stale');
    expect(store.getState().phase).toBe('result');
    store.getState().finishResult(round.id);
    expect(store.getState().phase).toBe('bet');
    store.dispose();
  });

  it('locks before awaiting a response and permits only one submission', async () => {
    let resolve!: () => void;
    const demo = createDemoRoulette(() => 0);
    const play = vi.fn(async (request) => {
      const result = await demo.play(request);
      return new Promise<RoundOutcome>((done) => {
        resolve = () => done(result);
      });
    });
    const { store } = session({ play });
    store.getState().placeBet('red');
    const first = store.getState().requestSpin();
    await store.getState().requestSpin();
    expect(store.getState().placeBet('black')).toBe(false);
    store.getState().clearBets();
    expect(store.getState().bets).toEqual({ red: 5 });
    expect(play).toHaveBeenCalledTimes(1);
    resolve();
    await first;
    expect(store.getState().phase).toBe('spin');
    store.dispose();
  });

  it('does not submit without a renderer or a stake', async () => {
    const play = vi.fn(createDemoRoulette().play);
    const { store } = session({ play });
    await store.getState().requestSpin();
    store.getState().placeBet('red');
    store.getState().setRendererReady(false);
    await store.getState().requestSpin();
    expect(play).not.toHaveBeenCalled();
    store.dispose();
  });

  it('keeps chips and balance on failure without automatically retrying', async () => {
    const play = vi.fn().mockRejectedValue(new Error('offline'));
    const { store } = session({ play });
    store.getState().placeBet('red');
    await store.getState().requestSpin();
    expect(store.getState()).toMatchObject({
      phase: 'bet',
      balance: 995,
      bets: { red: 5 },
      warning: 'roundFailed',
    });
    expect(play).toHaveBeenCalledTimes(1);
    store.dispose();
  });

  it('rejects a response for a different request without crediting it', async () => {
    const demo = createDemoRoulette(() => 1);
    const { store } = session({
      play: async (request) => ({ ...(await demo.play(request)), id: 'other-round' }),
    });
    store.getState().placeBet('red');
    await store.getState().requestSpin();
    expect(store.getState()).toMatchObject({
      phase: 'bet',
      balance: 995,
      round: null,
      warning: 'roundFailed',
    });
    store.dispose();
  });

  it('restores an accepted round before presentation and settles it only once', async () => {
    const { store, storage } = session();
    store.getState().placeBet('n1');
    await store.getState().requestSpin();
    const id = store.getState().round!.id;
    store.dispose();
    const play = vi.fn();
    const resumed = createGameStore({ play }, storage);
    expect(resumed.getState()).toMatchObject({ phase: 'spin', balance: 995, bets: { n1: 5 } });
    resumed.getState().finishSpin(id);
    expect(resumed.getState().balance).toBe(1175);
    resumed.dispose();
    const settled = createGameStore({ play }, storage);
    expect(settled.getState()).toMatchObject({
      phase: 'bet',
      balance: 1175,
      history: [1],
      round: null,
    });
    settled.getState().finishSpin(id);
    expect(settled.getState().balance).toBe(1175);
    expect(play).not.toHaveBeenCalled();
    settled.dispose();
  });

  it('refunds unsubmitted selections on reload and cleans up its subscription', () => {
    const { store, storage } = session();
    store.getState().placeBet('red');
    expect(storage.load()?.balance).toBe(1000);
    store.dispose();
    const saved = storage.load();
    store.getState().placeBet('black');
    expect(storage.load()).toEqual(saved);
    const restored = createGameStore(createDemoRoulette(), storage);
    expect(restored.getState()).toMatchObject({ balance: 1000, bets: {} });
    restored.dispose();
  });

  it('discards a late adapter response after the session is disposed', async () => {
    let resolve!: () => void;
    const demo = createDemoRoulette(() => 0);
    const { store } = session({
      play: async (request) => {
        await new Promise<void>((done) => {
          resolve = done;
        });
        return demo.play(request);
      },
    });
    store.getState().placeBet('red');
    const pending = store.getState().requestSpin();
    store.dispose();
    resolve();
    await pending;
    expect(store.getState().round).toBeNull();
  });
});

describe('betting credits', () => {
  it('undo and clear return exactly the reserved chips', () => {
    const { store } = session();
    store.getState().placeBet('red');
    store.getState().placeBet('red');
    store.getState().placeBet('black');
    store.getState().undoBet();
    expect(store.getState()).toMatchObject({ balance: 990, bets: { red: 10 } });
    store.getState().removeBet('red');
    store.getState().undoBet();
    store.getState().clearBets();
    expect(store.getState()).toMatchObject({ balance: 1000, bets: {} });
    store.dispose();
  });

  it('rebet is a single undoable operation after the result presentation', async () => {
    const { store } = session();
    store.getState().placeBet('red');
    store.getState().placeBet('d1');
    await store.getState().requestSpin();
    const id = store.getState().round!.id;
    store.getState().finishSpin(id);
    store.getState().finishResult(id);
    const before = store.getState().balance;
    store.getState().rebet();
    expect(store.getState()).toMatchObject({ balance: before - 10, bets: { red: 5, d1: 5 } });
    store.getState().undoBet();
    expect(store.getState()).toMatchObject({ balance: before, bets: {} });
    store.dispose();
  });

  it('does not allow overspending and refills only an exhausted demo balance', () => {
    const saved: SavedGame = {
      version: 2,
      balance: 1,
      history: [],
      lastBets: { red: 5 },
      resultIndex: 0,
      pending: null,
    };
    const store = createGameStore(createDemoRoulette(), { load: () => saved, save: () => {} });
    expect(store.getState().placeBet('red')).toBe(false);
    store.getState().rebet();
    expect(store.getState().balance).toBe(1);
    store.getState().refill();
    expect(store.getState().balance).toBe(1);
    store.getState().selectChip(1);
    store.getState().placeBet('red');
    store.getState().refill();
    expect(store.getState().balance).toBe(0);
    store.dispose();
  });
});
