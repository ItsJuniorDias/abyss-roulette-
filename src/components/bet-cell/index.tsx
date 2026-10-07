import type { BetCellProps } from '../../interfaces/components.ts';
import { BETS, colorOf } from '../../config/roulette.ts';
import { chipColor } from '../../config/game.ts';
import { formatCredits } from '../../utils/credits.ts';
import { t } from '../../utils/i18n.ts';
export function BetCell({
  bet,
  amount,
  disabled,
  result,
  className = '',
  position,
  onBet,
  onRemove,
}: BetCellProps) {
  const definition = BETS[bet];
  const label =
    bet === 'n0'
      ? t('zero')
      : bet.startsWith('n')
        ? `${definition.label} ${colorOf(Number(bet.slice(1)))}`
        : bet.startsWith('c')
          ? t('columnAria', { number: bet.slice(1) })
          : definition.label;
  const aria = t('betAria', { label, pay: definition.pay });
  const hit = result?.pocket === Number(bet.slice(1)) && bet.startsWith('n'),
    won = result?.winners.includes(bet);
  return (
    <button
      type="button"
      className={`cell ${className}${hit ? ' hit' : ''}${won ? ' won' : ''}`}
      data-bet={bet}
      style={
        position
          ? {
              gridColumn: `${position[0]} / span ${position[2]}`,
              gridRow: `${position[1]} / span ${position[3]}`,
            }
          : undefined
      }
      disabled={disabled}
      aria-disabled={disabled}
      aria-pressed={amount > 0}
      aria-label={
        amount ? t('betPlacedAria', { label: aria, amount: formatCredits(amount) }) : aria
      }
      onClick={(event) => onBet(bet, event.currentTarget)}
      onContextMenu={(event) => {
        event.preventDefault();
        onRemove(bet);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          event.stopPropagation();
          onRemove(bet);
        }
      }}
    >
      {definition.label}
      {amount > 0 && (
        <span className="chipmark" style={{ background: chipColor(amount) }}>
          {amount}
        </span>
      )}
    </button>
  );
}
