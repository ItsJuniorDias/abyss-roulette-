import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { RoundOutcome } from '../interfaces/roulette-session.ts';
import type { useBoardEffects } from './use-board-effects.ts';
export function useResultEffects(
  round: RoundOutcome | null,
  shell: RefObject<HTMLElement | null>,
  effects: ReturnType<typeof useBoardEffects>,
) {
  useEffect(() => {
    if (!round) return;
    effects.result(round.pocket);
    const flash = shell.current?.querySelector<HTMLElement>('#flash');
    if (flash && round.payout > round.staked)
      effects.animate(flash, [{ opacity: 0.14 }, { opacity: 0 }], {
        duration: 600,
        easing: 'ease-out',
      });
  }, [round, shell, effects]);
}
