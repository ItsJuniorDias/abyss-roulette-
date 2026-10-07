import { isBetKey } from '../config/roulette.ts';
import { isCreditAmount, sumBets } from './credits.ts';
import type { Bets } from '../types/game.ts';
import type { RoundOutcome, RoundRequest } from '../interfaces/roulette-session.ts';
export function parseBets(value: unknown): Bets {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const bets: Bets = {};
  for (const [key, amount] of Object.entries(value))
    if (isBetKey(key) && isCreditAmount(amount) && amount > 0) bets[key] = amount;
  return bets;
}
export function isRoundOutcome(value: unknown): value is RoundOutcome {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<RoundOutcome>;
  return (
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    Number.isInteger(r.pocket) &&
    r.pocket! >= 0 &&
    r.pocket! <= 36 &&
    isCreditAmount(r.staked) &&
    r.staked > 0 &&
    isCreditAmount(r.payout) &&
    isCreditAmount(r.balance) &&
    !!r.bets &&
    typeof r.bets === 'object' &&
    !Array.isArray(r.bets) &&
    Object.keys(r.bets).length > 0 &&
    Object.keys(r.bets).every(isBetKey) &&
    Object.values(r.bets).every((v) => isCreditAmount(v) && v > 0) &&
    sumBets(r.bets) === r.staked &&
    Array.isArray(r.winners) &&
    new Set(r.winners).size === r.winners.length &&
    r.winners.every((k) => typeof k === 'string' && isBetKey(k) && Object.hasOwn(r.bets!, k))
  );
}
export function validateOutcome(
  value: unknown,
  request: RoundRequest,
): asserts value is RoundOutcome {
  if (
    !isRoundOutcome(value) ||
    value.id !== request.id ||
    value.staked !== sumBets(request.bets) ||
    Object.keys(value.bets).length !== Object.keys(request.bets).length ||
    Object.entries(value.bets).some(
      ([key, amount]) => request.bets[key as keyof Bets] !== amount,
    ) ||
    value.balance !== request.balanceBefore - value.staked + value.payout
  )
    throw new Error('Invalid round response');
}
