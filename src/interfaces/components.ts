import type { ReactNode, RefObject } from 'react';
import type { GameStore } from '../stores/game-store.ts';
import type { AudioSession } from '../providers/audio-session.ts';
import type { BetKey, SheetName, MascotState } from '../types/game.ts';
import type { GameControls } from '../hooks/use-game-controls.ts';
import type { GameState } from './roulette-session.ts';
import type { RoundOutcome } from './roulette-session.ts';
export interface GameServices {
  store: GameStore;
  audio: AudioSession;
}
export interface GameViewProps extends GameServices {
  shell: RefObject<HTMLElement | null>;
}
export interface BetCellProps {
  bet: BetKey;
  amount: number;
  disabled: boolean;
  result: RoundOutcome | null;
  className?: string;
  position?: readonly [number, number, number, number];
  onBet: (key: BetKey, element: HTMLButtonElement) => void;
  onRemove: (key: BetKey) => void;
}
export interface BottomSheetProps {
  name: Exclude<SheetName, null>;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  shell: RefObject<HTMLElement | null>;
}

export interface AppProps {
  store: GameStore;
}
export interface SceneManagerProps extends AppProps {
  audio: AudioSession | null;
}
export interface GameHudProps {
  balance: number;
  onMenu: () => void;
}
export interface MascotProps {
  state: MascotState;
}
export interface BettingPanelProps {
  state: GameState;
  controls: GameControls;
  onTable: () => void;
}
export interface ResultBannerProps extends GameServices {
  round: RoundOutcome | null;
}
export interface ErrorBoundaryProps {
  children: ReactNode;
}
export interface ErrorBoundaryState {
  failed: boolean;
}
