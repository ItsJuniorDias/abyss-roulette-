import type { GameHudProps } from '../../interfaces/components.ts';
import { useAnimatedCredits } from '../../hooks/use-animated-credits.ts';
import { formatCredits } from '../../utils/credits.ts';
import { t } from '../../utils/i18n.ts';
export function GameHud({ balance, onMenu }: GameHudProps) {
  const displayed = useAnimatedCredits(balance);
  return (
    <header id="top">
      <div className="brand" aria-label={t('brandAria')}>
        <div className="title">
          {t('brand')}
          <span>{t('brandSubtitle')}</span>
        </div>
      </div>
      <div className={`stat ${displayed < balance ? 'gain' : ''}`} id="balbox">
        <span>{t('balance')}</span>
        <div>
          <b id="balance">{formatCredits(displayed)}</b>
        </div>
      </div>
      <button
        className="icon-button"
        id="menu-open"
        aria-label={t('menuOpen')}
        aria-haspopup="dialog"
        onClick={onMenu}
      >
        ☰
      </button>
    </header>
  );
}
