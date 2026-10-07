import type { Bets } from '../types/game.ts';
export const sumBets = (bets: Bets): number =>
  Object.values(bets).reduce<number>((sum, value) => sum + (value ?? 0), 0);
export const formatCredits = (value: number): string =>
  new Intl.NumberFormat('en-US').format(value);
export const isCreditAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
