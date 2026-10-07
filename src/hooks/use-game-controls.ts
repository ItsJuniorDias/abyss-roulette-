import { useCallback, useEffect, useState } from 'react';
import { CHIPS, chipColor } from '../config/game.ts';
import type { BetKey, ChipValue } from '../types/game.ts';
import type { GameViewProps } from '../interfaces/components.ts';
import { useBoardEffects } from './use-board-effects.ts';
export function useGameControls({ store, audio, shell }: GameViewProps, onSpin: () => void) {
  const effects = useBoardEffects(shell);
  const [muted, setMuted] = useState(() => audio.isMuted());
  const toggleSound = useCallback(() => {
    audio.start();
    setMuted(audio.toggleMute());
  }, [audio]);
  const selectChip = useCallback(
    (value: ChipValue) => {
      store.getState().selectChip(value);
      audio.uiClick();
    },
    [store, audio],
  );
  const placeBet = useCallback(
    (key: BetKey, element: HTMLButtonElement) => {
      const amount = store.getState().chip;
      if (store.getState().placeBet(key)) {
        effects.chip(element, amount, chipColor(amount));
        audio.chip();
      }
    },
    [store, audio, effects],
  );
  const removeBet = useCallback(
    (key: BetKey) => {
      store.getState().removeBet(key);
      audio.uiClick();
    },
    [store, audio],
  );
  const clearBets = useCallback(() => {
    if (store.getState().phase !== 'bet') return;
    effects.clear();
    store.getState().clearBets();
    audio.sweep();
  }, [store, audio, effects]);
  const undo = useCallback(() => {
    store.getState().undoBet();
    audio.uiClick();
  }, [store, audio]);
  const rebet = useCallback(() => {
    store.getState().rebet();
    audio.chip();
  }, [store, audio]);
  const refill = useCallback(() => {
    store.getState().refill();
    audio.sweep();
  }, [store, audio]);
  const spin = useCallback(() => {
    if (store.getState().phase !== 'bet') return;
    onSpin();
    void store.getState().requestSpin();
  }, [store, onSpin]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.altKey ||
        (event.ctrlKey && event.code !== 'KeyZ') ||
        (event.target instanceof Element &&
          event.target.closest('button,input,select,textarea,[role="dialog"]'))
      )
        return;
      if (event.code === 'Space') {
        event.preventDefault();
        spin();
      } else if (event.code === 'KeyM') toggleSound();
      else if (event.code === 'KeyZ' || event.code === 'Backspace') {
        event.preventDefault();
        undo();
      } else if (event.code === 'KeyR') rebet();
      else if (event.code === 'KeyC') clearBets();
      else if (/^Digit[1-4]$/.test(event.code)) selectChip(CHIPS[Number(event.code.at(-1)) - 1][0]);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [spin, toggleSound, undo, rebet, clearBets, selectChip]);
  return {
    muted,
    toggleSound,
    selectChip,
    placeBet,
    removeBet,
    clearBets,
    undo,
    rebet,
    refill,
    spin,
    effects,
  };
}
export type GameControls = ReturnType<typeof useGameControls>;
