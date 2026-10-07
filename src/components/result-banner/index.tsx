import { useRoundPresentation } from '../../hooks/use-round-presentation.ts';

import type { ResultBannerProps } from '../../interfaces/components.ts';
import { colorOf } from '../../config/roulette.ts';
import { formatCredits } from '../../utils/credits.ts';
import { t } from '../../utils/i18n.ts';
export function ResultBanner({ round, store, audio }: ResultBannerProps) {
  const ref = useRoundPresentation(round, { store, audio });
  return (
    <div
      id="banner"
      ref={ref}
      className={round ? `show ${round.payout === 0 ? 'loss' : ''}` : 'hidden'}
      aria-hidden={!round}
    >
      {round && (
        <>
          <div className="sfx" id="sfx">
            {t(
              round.payout > round.staked
                ? 'winLabel'
                : round.payout
                  ? 'payoutLabel'
                  : 'resultLabel',
            )}
          </div>
          <div className="result-row">
            <div className={`num ${colorOf(round.pocket)}`} id="bnum">
              {round.pocket}
            </div>
            <div className="sub" id="bsub">
              {round.payout
                ? `+${formatCredits(round.payout)} ${t('credits')}`
                : `${t('roundComplete')} · −${formatCredits(round.staked)}`}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
