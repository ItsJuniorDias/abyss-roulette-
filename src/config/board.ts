import { colorOf } from './roulette.ts';
import type { BetKey } from '../types/game.ts';
interface BoardSpot {
  key: BetKey;
  className: string;
  position: readonly [number, number, number, number];
}
export const QUICK_BETS: BetKey[] = [
  'red',
  'black',
  'low',
  'even',
  'odd',
  'high',
  'd1',
  'd2',
  'd3',
];
export const FULL_BOARD: BoardSpot[] = [{ key: 'n0', className: 'green', position: [3, 1, 3, 1] }];
for (let n = 1; n <= 36; n++)
  FULL_BOARD.push({
    key: `n${n}`,
    className: colorOf(n),
    position: [((n - 1) % 3) + 3, Math.ceil(n / 3) + 1, 1, 1],
  });
for (const k of [1, 2, 3] as const) {
  FULL_BOARD.push({ key: `c${k}`, className: 'out', position: [k + 2, 14, 1, 1] });
  FULL_BOARD.push({ key: `d${k}`, className: 'out dz', position: [2, 2 + (k - 1) * 4, 1, 4] });
}
(['low', 'even', 'red', 'black', 'odd', 'high'] as const).forEach((key, i) =>
  FULL_BOARD.push({
    key,
    className: `out ${key === 'red' || key === 'black' ? key : ''}`,
    position: [1, 2 + i * 2, 1, 2],
  }),
);
