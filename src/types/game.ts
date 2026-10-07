export type PocketColor = 'green' | 'red' | 'black';
export type OutsideBet = 'low' | 'even' | 'red' | 'black' | 'odd' | 'high';
export type BetKey = `n${number}` | `d${1 | 2 | 3}` | `c${1 | 2 | 3}` | OutsideBet;
export type Bets = Partial<Record<BetKey, number>>;
export type Phase = 'bet' | 'requesting' | 'spin' | 'result';
export type ChipValue = 1 | 5 | 25 | 100;
export type MascotState = 'welcome' | 'idle' | 'spin' | 'win' | 'loss';
export type SheetName = 'table' | 'menu' | null;
