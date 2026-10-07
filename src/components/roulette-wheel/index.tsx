import { useRouletteWheel } from '../../hooks/use-roulette-wheel.ts';
import type { GameServices } from '../../interfaces/components.ts';
import { t } from '../../utils/i18n.ts';
export function RouletteWheel({ store, audio }: GameServices) {
  const refs = useRouletteWheel(store, audio);
  return (
    <div id="wheel-viewport" ref={refs.viewport}>
      <canvas id="gl" ref={refs.canvas} aria-label={t('wheelAria')} />
      <span className="wheel-caption">{t('wheelCaption')}</span>
    </div>
  );
}
