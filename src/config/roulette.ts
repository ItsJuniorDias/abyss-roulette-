import { t } from '../utils/i18n.ts';
import type { BetDefinition } from '../interfaces/roulette-session.ts';
import type { BetKey, PocketColor } from '../types/game.ts';
// European roulette rules (single zero).
export const ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const N = ORDER.length;
export const SEG = (Math.PI * 2) / N;

const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n: number): PocketColor =>
  n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';

// pay = profit multiplier (35 => pays 35:1 plus the stake back)
export const BETS = {} as Record<BetKey, BetDefinition>;
for (let n = 0; n <= 36; n++)
  BETS[`n${n}`] = { label: String(n), pay: 35, win: (r: number) => r === n };
for (let k = 1; k <= 3; k++) {
  BETS[`d${k as 1 | 2 | 3}`] = {
    label: t((['firstDozen', 'secondDozen', 'thirdDozen'] as const)[k - 1]),
    pay: 2,
    win: (r: number) => r > 0 && Math.ceil(r / 12) === k,
  };
  BETS[`c${k as 1 | 2 | 3}`] = {
    label: '2:1',
    pay: 2,
    win: (r: number) => r > 0 && ((r - 1) % 3) + 1 === k,
  };
}
Object.assign(BETS, {
  low: { label: '1-18', pay: 1, win: (r: number) => r >= 1 && r <= 18 },
  even: { label: t('betEven'), pay: 1, win: (r: number) => r > 0 && r % 2 === 0 },
  red: { label: t('betRed'), pay: 1, win: (r: number) => colorOf(r) === 'red' },
  black: { label: t('betBlack'), pay: 1, win: (r: number) => colorOf(r) === 'black' },
  odd: { label: t('betOdd'), pay: 1, win: (r: number) => r % 2 === 1 },
  high: { label: '19-36', pay: 1, win: (r: number) => r >= 19 && r <= 36 },
});

export const isBetKey = (key: string): key is BetKey => Object.hasOwn(BETS, key);
