import { useEffect, useRef } from 'react';
import { TIMING } from '../config/game.ts';
import type { GameServices } from '../interfaces/components.ts';
import type { RoundOutcome } from '../interfaces/roulette-session.ts';
export function useRoundPresentation(round: RoundOutcome | null, { store, audio }: GameServices) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const banner = ref.current;
    if (!round || !banner) return;
    audio.result(
      round.payout > round.staked ? (round.payout >= round.staked * 10 ? 'bigwin' : 'win') : 'lose',
    );
    // This checkpoint releases the result presentation only. The spin checkpoint
    // has already reconciled the adapter's balance; no timer settles money.
    const presentation = banner.animate([{ opacity: 1 }, { opacity: 1 }], {
      duration: TIMING.resultMs,
    });
    presentation.onfinish = () => store.getState().finishResult(round.id);
    return () => {
      presentation.onfinish = null;
      presentation.cancel();
    };
  }, [round, store, audio]);
  return ref;
}
