import { createStore } from 'zustand/vanilla';
import { CHIPS, MIN_CHIP, START_BALANCE } from '../config/game.ts';
import { isBetKey, ORDER } from '../config/roulette.ts';
import { sumBets } from '../utils/credits.ts';
import { validateOutcome } from '../utils/round-contract.ts';
import type {
  GameActions,
  GameState,
  GameStorage,
  RoulettePort,
} from '../interfaces/roulette-session.ts';
import type { BetKey } from '../types/game.ts';
export function createGameStore(port: RoulettePort, storage: GameStorage) {
  const saved = storage.load();
  let disposed = false;
  const store = createStore<GameState & GameActions>((set, get) => ({
    phase: saved?.pending ? 'spin' : 'bet',
    balance: saved?.balance ?? START_BALANCE,
    chip: 5,
    bets: saved?.pending?.bets ?? {},
    lastBets: saved?.lastBets ?? {},
    undo: [],
    history: saved?.history ?? [],
    resultIndex: saved?.resultIndex ?? 0,
    round: saved?.pending ?? null,
    roundSequence: 0,
    warning: '',
    hasPlayed: !!saved?.history.length,
    rendererReady: false,
    rendererError: '',
    setRendererReady(ready, error = '') {
      set({ rendererReady: ready, rendererError: error });
    },
    selectChip(chip) {
      if (get().phase === 'bet' && CHIPS.some(([value]) => value === chip)) set({ chip });
    },
    placeBet(key) {
      const s = get();
      if (s.phase !== 'bet' || !isBetKey(key)) return false;
      if (s.balance < s.chip) {
        set({ warning: s.balance < MIN_CHIP ? 'outOfCredits' : 'insufficientChip' });
        return false;
      }
      set({
        balance: s.balance - s.chip,
        bets: { ...s.bets, [key]: (s.bets[key] ?? 0) + s.chip },
        undo: [...s.undo, [[key, s.chip]]],
        warning: '',
        round: null,
      });
      return true;
    },
    removeBet(key) {
      const s = get();
      if (s.phase !== 'bet' || !s.bets[key]) return;
      const bets = { ...s.bets };
      const amount = bets[key]!;
      delete bets[key];
      set({ bets, balance: s.balance + amount, warning: '' });
    },
    undoBet() {
      const s = get();
      if (s.phase !== 'bet') return;
      const step = s.undo.at(-1);
      if (!step) {
        set({ warning: 'nothingToUndo' });
        return;
      }
      const bets = { ...s.bets };
      let balance = s.balance;
      for (const [key, amount] of step) {
        const take = Math.min(bets[key] ?? 0, amount);
        balance += take;
        const remaining = (bets[key] ?? 0) - take;
        if (remaining) bets[key] = remaining;
        else delete bets[key];
      }
      set({ balance, bets, undo: s.undo.slice(0, -1), warning: '' });
    },
    clearBets() {
      const s = get();
      if (s.phase === 'bet')
        set({ balance: s.balance + sumBets(s.bets), bets: {}, undo: [], warning: '' });
    },
    rebet() {
      const s = get();
      if (s.phase !== 'bet') return;
      const cost = sumBets(s.lastBets);
      if (!cost) {
        set({ warning: 'noPreviousBets' });
        return;
      }
      if (cost > s.balance) {
        set({ warning: 'insufficientRebet' });
        return;
      }
      const bets = { ...s.bets };
      const step = Object.entries(s.lastBets) as [BetKey, number][];
      for (const [key, value] of step) bets[key] = (bets[key] ?? 0) + value;
      set({ balance: s.balance - cost, bets, undo: [...s.undo, step], warning: '', round: null });
    },
    refill() {
      const s = get();
      if (s.phase === 'bet' && s.balance + sumBets(s.bets) < MIN_CHIP)
        set({ balance: s.balance + START_BALANCE, warning: '' });
    },
    async requestSpin() {
      const s = get();
      if (disposed || s.phase !== 'bet' || !s.rendererReady || !sumBets(s.bets)) return;
      const request = {
        id: crypto.randomUUID(),
        bets: { ...s.bets },
        balanceBefore: s.balance + sumBets(s.bets),
      };
      set({ phase: 'requesting', warning: '', round: null });
      try {
        const round = await port.play(request);
        if (disposed) return;
        validateOutcome(round, request);
        set({ round, phase: 'spin', roundSequence: s.roundSequence + 1 });
      } catch {
        if (!disposed) set({ phase: 'bet', warning: 'roundFailed' });
      }
    },
    finishSpin(id) {
      const s = get();
      const round = s.round;
      if (s.phase !== 'spin' || !round || round.id !== id) return;
      set({
        phase: 'result',
        balance: round.balance,
        lastBets: { ...round.bets },
        bets: {},
        undo: [],
        history: [round.pocket, ...s.history].slice(0, 12),
        resultIndex: ORDER.indexOf(round.pocket),
        hasPlayed: true,
      });
    },
    finishResult(id) {
      const s = get();
      if (s.phase === 'result' && s.round?.id === id) set({ phase: 'bet' });
    },
  }));
  const persist = () => {
    const s = store.getState();
    storage.save({
      version: 2,
      balance: s.balance + (s.phase === 'bet' || s.phase === 'requesting' ? sumBets(s.bets) : 0),
      lastBets: s.lastBets,
      history: s.history,
      resultIndex: s.resultIndex,
      pending: s.phase === 'spin' ? s.round : null,
    });
  };
  const unsubscribe = store.subscribe(persist);
  return Object.assign(store, {
    dispose() {
      disposed = true;
      unsubscribe();
    },
  });
}
export type GameStore = ReturnType<typeof createGameStore>;
