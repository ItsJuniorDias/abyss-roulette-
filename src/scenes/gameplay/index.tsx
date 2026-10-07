import { useCallback, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { GameServices } from '../../interfaces/components.ts';
import type { MascotState, SheetName } from '../../types/game.ts';
import { GameHud } from '../../components/game-hud/index.tsx';
import { Mascot } from '../../components/mascot/index.tsx';
import { RouletteWheel } from '../../components/roulette-wheel/index.tsx';
import { BettingPanel } from '../../components/betting-panel/index.tsx';
import { BottomSheet } from '../../components/bottom-sheet/index.tsx';
import { BetCell } from '../../components/bet-cell/index.tsx';
import { ResultBanner } from '../../components/result-banner/index.tsx';
import { useGameControls } from '../../hooks/use-game-controls.ts';
import { useResultEffects } from '../../hooks/use-result-effects.ts';
import { FULL_BOARD } from '../../config/board.ts';
import { ASSETS } from '../../config/assets.ts';
import { colorOf } from '../../config/roulette.ts';
import { formatCredits, sumBets } from '../../utils/credits.ts';
import { t } from '../../utils/i18n.ts';
import type { MessageKey } from '../../utils/i18n.ts';
export function GameplayScene({ store, audio }: GameServices) {
  const state = useStore(store, (s) => s),
    shell = useRef<HTMLElement>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const close = useCallback(() => setSheet(null), []);
  const dismiss = useCallback(() => {
    audio.uiClick();
    close();
  }, [audio, close]);
  const controls = useGameControls({ store, audio, shell }, close);
  const round = state.phase === 'result' ? state.round : null,
    locked = state.phase !== 'bet',
    staked = sumBets(state.bets);
  useResultEffects(round, shell, controls.effects);
  const mascot: MascotState =
    state.phase === 'spin'
      ? 'spin'
      : round
        ? round.payout > round.staked
          ? 'win'
          : round.payout === round.staked
            ? 'idle'
            : 'loss'
        : state.hasPlayed
          ? 'idle'
          : 'welcome';
  const hostTitle: MessageKey =
    state.phase === 'spin'
      ? 'noMoreBets'
      : round
        ? 'roundComplete'
        : state.hasPlayed
          ? 'placeBets'
          : 'hostEyebrow';
  const hostMessage: MessageKey =
    state.phase === 'spin'
      ? 'hostSpin'
      : round
        ? round.payout > round.staked
          ? 'hostWin'
          : 'hostResult'
        : state.hasPlayed
          ? 'hostBet'
          : 'hostWelcome';
  const open = (name: SheetName) => {
    audio.uiClick();
    setSheet(name);
  };
  return (
    <>
      <main id="game-shell" ref={shell} data-phase={state.phase} data-ready={state.rendererReady}>
        <div id="bg" style={{ backgroundImage: `url(${ASSETS.backdrop})` }} aria-hidden="true" />
        <div id="ambient-shade" aria-hidden="true" />
        <GameHud balance={state.balance} onMenu={() => open('menu')} />
        <section id="stage" aria-label={t('stageAria')}>
          <div className="host-copy">
            <span className="eyebrow" id="host-eyebrow">
              {t(hostTitle)}
            </span>
            <p id="host-message">{t(hostMessage)}</p>
          </div>
          <Mascot state={mascot} />
          <RouletteWheel store={store} audio={audio} />
          <ResultBanner round={round} store={store} audio={audio} />
          {state.rendererError && (
            <div className="renderer-error" role="alert">
              {t(state.rendererError)}
            </div>
          )}
        </section>
        <aside id="history-panel" aria-label={t('recentResults')}>
          <span className="eyebrow">{t('recent')}</span>
          <div id="history">
            {state.history.map((n, i) => (
              <div
                key={`${i}-${n}`}
                className={`h ${colorOf(n)}`}
                aria-label={`${n} ${colorOf(n)}`}
              >
                {n}
              </div>
            ))}
          </div>
          <span id="history-empty" hidden={state.history.length > 0}>
            {t('emptyHistory')}
          </span>
          <span className="demo-badge">{t('demo')}</span>
        </aside>
        <BettingPanel state={state} controls={controls} onTable={() => open('table')} />
        <div className="home-area" aria-hidden="true">
          <span />
        </div>
        <div id="vig" aria-hidden="true" />
        <div id="flash" aria-hidden="true" />
        <div id="sheet-backdrop" hidden={!sheet} onClick={dismiss} />
        <BottomSheet
          name="table"
          title={t('fullTable')}
          open={sheet === 'table'}
          onClose={dismiss}
          shell={shell}
        >
          <div id="boardWrap" tabIndex={0} aria-label={t('scrollTable')}>
            <div
              id="board"
              className={locked ? 'tall locked' : 'tall'}
              role="group"
              aria-label={t('allBets')}
            >
              {FULL_BOARD.map((spot) => (
                <BetCell
                  key={spot.key}
                  bet={spot.key}
                  amount={state.bets[spot.key] ?? 0}
                  disabled={locked}
                  result={state.round}
                  className={spot.className}
                  position={spot.position}
                  onBet={controls.placeBet}
                  onRemove={controls.removeBet}
                />
              ))}
            </div>
          </div>
          <footer className="sheet-footer">
            <div>
              <span>{t('totalBet')}</span>
              <b id="sheet-staked">{formatCredits(staked)}</b>
            </div>
            <button className="btn" id="table-done" onClick={dismiss}>
              {t('done')}
            </button>
          </footer>
        </BottomSheet>
        <BottomSheet
          name="menu"
          title={t('menuTitle')}
          open={sheet === 'menu'}
          onClose={dismiss}
          shell={shell}
        >
          <div className="table-actions">
            <button
              className="btn"
              id="undo"
              disabled={locked || !state.undo.length}
              onClick={controls.undo}
            >
              {t('undo')}
            </button>
            <button
              className="btn"
              id="repeat"
              disabled={locked || !sumBets(state.lastBets)}
              onClick={controls.rebet}
            >
              {t('repeat')}
            </button>
            <button
              className="btn mute"
              id="mute"
              aria-pressed={controls.muted}
              onClick={controls.toggleSound}
            >
              {t('sound')} <b>{t(controls.muted ? 'off' : 'on')}</b>
            </button>
          </div>
          <p className="menu-note" style={{ whiteSpace: 'pre-line' }}>
            {t('menuNote')}
          </p>
        </BottomSheet>
        <div id="sr" className="sr-only" aria-live="polite">
          {round
            ? t(round.payout ? 'resultPayout' : 'resultLoss', {
                number: round.pocket,
                color: colorOf(round.pocket),
                amount: formatCredits(round.payout || round.staked),
                balance: formatCredits(state.balance),
              })
            : ''}
        </div>
      </main>
      <div id="rotate-hint" role="status">
        <span aria-hidden="true">↻</span>
        <h2>{t('portraitTitle')}</h2>
        <p>{t('portraitHint')}</p>
      </div>
    </>
  );
}
