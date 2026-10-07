import type { RoundOutcome, RoulettePort } from '../interfaces/roulette-session.ts';
import { BETS, ORDER } from '../config/roulette.ts';
import { secureIndex } from '../utils/random.ts';
import { isCreditAmount, sumBets } from '../utils/credits.ts';
import { isRoundOutcome, parseBets, validateOutcome } from '../utils/round-contract.ts';
import type { BetKey } from '../types/game.ts';
/** Local play-credit adapter only. A real RGS must implement its own authoritative port. */
export function createDemoRoulette(pick: () => number = secureIndex): RoulettePort {
  const accepted = new Map<string, RoundOutcome>();
  return {
    async play(request) {
      const existing = accepted.get(request.id);
      if (existing) {
        validateOutcome(existing, request);
        return structuredClone(existing);
      }
      const parsed = parseBets(request.bets);
      if (
        !request.id ||
        !isCreditAmount(request.balanceBefore) ||
        Object.keys(parsed).length !== Object.keys(request.bets).length
      )
        throw new Error('Invalid demo request');
      const pocket = ORDER[pick()];
      const staked = sumBets(request.bets);
      if (
        !Number.isInteger(pocket) ||
        !isCreditAmount(staked) ||
        staked <= 0 ||
        staked > request.balanceBefore
      )
        throw new Error('Invalid demo round');
      const winners = (Object.keys(request.bets) as BetKey[]).filter((key) =>
        BETS[key].win(pocket),
      );
      const payout = winners.reduce(
        (sum, key) => sum + (request.bets[key] ?? 0) * (BETS[key].pay + 1),
        0,
      );
      const result = {
        id: request.id,
        pocket,
        bets: { ...request.bets },
        staked,
        payout,
        balance: request.balanceBefore - staked + payout,
        winners,
      };
      if (!isRoundOutcome(result)) throw new Error('Invalid demo settlement');
      accepted.set(request.id, result);
      if (accepted.size > 100) accepted.delete(accepted.keys().next().value!);
      return structuredClone(result);
    },
  };
}
