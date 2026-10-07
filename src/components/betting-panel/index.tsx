import type { BettingPanelProps } from '../../interfaces/components.ts';

import { QUICK_BETS } from '../../config/board.ts';
import { CHIPS, MIN_CHIP } from '../../config/game.ts';
import { BetCell } from '../bet-cell/index.tsx';
import { formatCredits, sumBets } from '../../utils/credits.ts';
import { t } from '../../utils/i18n.ts';

export function BettingPanel({ state, controls, onTable }: BettingPanelProps) {
  const locked = state.phase !== 'bet',
    staked = sumBets(state.bets),
    broke = !locked && state.balance + staked < MIN_CHIP;
  const message = state.warning
    ? t(state.warning)
    : state.phase === 'spin'
      ? t('spinMessage')
      : state.phase === 'result'
        ? t('resultMessage')
        : t(matchMedia('(hover: none)').matches ? 'touchHint' : 'hint');
  return (
    <section id="panel" aria-label={t('bettingControls')}>
      <div className="table-heading">
        <h1>{t('placeBets')}</h1>
        <button
          id="full-table-open"
          className="text-button"
          aria-haspopup="dialog"
          disabled={locked}
          onClick={onTable}
        >
          {t('fullTable')} ↗
        </button>
      </div>
      <div id="quick-board" role="group" aria-label={t('quickBets')}>
        {QUICK_BETS.map((key) => (
          <BetCell
            key={key}
            bet={key}
            amount={state.bets[key] ?? 0}
            disabled={locked}
            result={state.round}
            className={key === 'red' || key === 'black' ? key : 'out'}
            onBet={controls.placeBet}
            onRemove={controls.removeBet}
          />
        ))}
      </div>
      <div className="chip-picker">
        <span className="control-label">{t('chip')}</span>
        <div id="chips" role="group" aria-label={t('chipValue')}>
          {CHIPS.map(([value, color], i) => (
            <button
              key={value}
              type="button"
              className={`chip${state.chip === value ? ' sel' : ''}${state.balance < value ? ' poor' : ''}`}
              data-v={value}
              style={{ background: color }}
              disabled={locked}
              aria-pressed={state.chip === value}
              aria-label={t('chipAria', { amount: value })}
              title={`${t('chipAria', { amount: value })} (${i + 1})`}
              onClick={() => controls.selectChip(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <button
          className="text-button"
          id="clear"
          title={t('clearShortcut')}
          disabled={locked || !staked}
          onClick={controls.clearBets}
        >
          {t('clear')}
        </button>
      </div>
      <div id="controls">
        <div className="stat stake-stat">
          <span>{t('totalBet')}</span>
          <b id="staked">{formatCredits(staked)}</b>
        </div>
        <button
          className="btn spin"
          id="spin"
          title={t('spinShortcut')}
          disabled={locked || !staked || !state.rendererReady}
          onClick={controls.spin}
        >
          {t(
            state.phase === 'spin'
              ? 'spinning'
              : state.phase === 'requesting'
                ? 'requesting'
                : state.phase === 'result'
                  ? 'roundComplete'
                  : staked
                    ? 'spin'
                    : 'placeBet',
          )}
          <span aria-hidden="true">↗</span>
        </button>
        <button className="btn refill" id="refill" hidden={!broke} onClick={controls.refill}>
          {t('refill')}
        </button>
      </div>
      <div id="msg" className={state.warning ? 'warn' : ''} role="status">
        {message}
      </div>
      <div className="table-footer">{t('footer')}</div>
    </section>
  );
}
