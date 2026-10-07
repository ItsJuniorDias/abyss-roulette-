import type { ChipValue } from '../types/game.ts';
export const START_BALANCE = 1000;
export const SAVE_KEY = 'aurum-club:save';
export const LEGACY_SAVE_KEY = 'abyss-roulette:save';
export const CHIPS: readonly (readonly [ChipValue, string])[] = [
  [1, '#147555'],
  [5, '#9e2435'],
  [25, '#131c1a'],
  [100, '#9d7737'],
];
export const MIN_CHIP = 1;
export const TIMING = {
  fadeMs: 300,
  resultMs: 5250,
  spinSeconds: 8.5,
  spinVariation: 1.5,
} as const;
export const chipColor = (amount: number) =>
  [...CHIPS].reverse().find(([value]) => amount >= value)?.[1] ?? CHIPS[0][1];
