import type { MessageKey } from '../utils/i18n.ts';
import type { Bets, BetKey, ChipValue, Phase } from '../types/game.ts';
export interface BetDefinition {
  label: string;
  pay: number;
  win: (pocket: number) => boolean;
}
export interface RoundRequest {
  id: string;
  bets: Bets;
  balanceBefore: number;
}
export interface RoundOutcome {
  id: string;
  pocket: number;
  bets: Bets;
  staked: number;
  payout: number;
  balance: number;
  winners: BetKey[];
}
/** The renderer never chooses outcomes or calculates a credited balance. */
export interface RoulettePort {
  play(request: RoundRequest): Promise<RoundOutcome>;
}
export interface SavedGame {
  version: 2;
  balance: number;
  lastBets: Bets;
  history: number[];
  resultIndex: number;
  pending: RoundOutcome | null;
}
export interface GameStorage {
  load(): SavedGame | null;
  save(state: SavedGame): void;
}
export interface GameState {
  phase: Phase;
  balance: number;
  chip: ChipValue;
  bets: Bets;
  lastBets: Bets;
  undo: [BetKey, number][][];
  history: number[];
  resultIndex: number;
  round: RoundOutcome | null;
  roundSequence: number;
  warning: MessageKey | '';
  hasPlayed: boolean;
  rendererReady: boolean;
  rendererError: MessageKey | '';
}
export interface GameActions {
  placeBet(key: BetKey): boolean;
  removeBet(key: BetKey): void;
  undoBet(): void;
  clearBets(): void;
  rebet(): void;
  refill(): void;
  selectChip(value: ChipValue): void;
  requestSpin(): Promise<void>;
  finishSpin(id: string): void;
  finishResult(id: string): void;
  setRendererReady(ready: boolean, error?: MessageKey | ''): void;
}
