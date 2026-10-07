import { describe, expect, it } from 'vitest';
import { createDemoRoulette } from './demo-roulette.ts';
import { BETS, ORDER, colorOf } from '../config/roulette.ts';
import type { Bets, BetKey } from '../types/game.ts';

describe('European roulette demo adapter', () => {
  it('has 37 distinct pockets, 18 red, 18 black and a single zero', () => {
    expect([...ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, i) => i));
    expect(ORDER.filter((n) => colorOf(n) === 'red')).toHaveLength(18);
    expect(ORDER.filter((n) => colorOf(n) === 'black')).toHaveLength(18);
  });
  it('zero loses every outside bet and pays 35:1 on the straight zero', async () => {
    const outside = Object.keys(BETS).filter((key) => !key.startsWith('n')) as BetKey[];
    const bets: Bets = { n0: 5 };
    outside.forEach((key) => {
      bets[key] = 5;
    });
    const result = await createDemoRoulette(() => 0).play({
      id: 'zero',
      bets,
      balanceBefore: 1000,
    });
    expect(result.winners).toEqual(['n0']);
    expect(result.payout).toBe(180);
    expect(result.balance).toBe(1000 - result.staked + 180);
  });
  it('combines winning bets and returns the stakes with each payout', async () => {
    const result = await createDemoRoulette(() => ORDER.indexOf(1)).play({
      id: 'one',
      bets: { n1: 1, red: 5, d1: 5, c1: 5 },
      balanceBefore: 1000,
    });
    expect(result.payout).toBe(76);
    expect(result.balance).toBe(1060);
    expect(result.winners).toEqual(['n1', 'red', 'd1', 'c1']);
  });
  it('returns the accepted result for a repeated ID without another draw or mutable cache', async () => {
    let calls = 0;
    const port = createDemoRoulette(() => {
      calls++;
      return calls;
    });
    const request = { id: 'same', bets: { red: 5 }, balanceBefore: 1000 };
    const first = await port.play(request);
    first.bets.red = 999;
    first.winners.length = 0;
    const again = await port.play(request);
    expect(calls).toBe(1);
    expect(again.bets).toEqual({ red: 5 });
    expect(again.winners).toEqual(['red']);
    await expect(port.play({ ...request, bets: { black: 5 } })).rejects.toThrow();
  });
  it.each([
    {},
    { red: -5 },
    { red: 0.5 },
    { n99: 5 },
    { red: 1001 },
    { red: Number.MAX_SAFE_INTEGER },
  ])('rejects invalid or unaffordable bets %j', async (bets) => {
    await expect(
      createDemoRoulette(() => 1).play({ id: 'invalid', bets: bets as Bets, balanceBefore: 1000 }),
    ).rejects.toThrow();
  });
  it('rejects credit overflow instead of rounding a payout', async () => {
    await expect(
      createDemoRoulette(() => 1).play({
        id: 'overflow',
        bets: { n32: Number.MAX_SAFE_INTEGER },
        balanceBefore: Number.MAX_SAFE_INTEGER,
      }),
    ).rejects.toThrow();
  });
});
