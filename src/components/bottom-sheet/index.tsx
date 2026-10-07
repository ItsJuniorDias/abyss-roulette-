import type { BottomSheetProps } from '../../interfaces/components.ts';
import { useBottomSheet } from '../../hooks/use-bottom-sheet.ts';
import { t } from '../../utils/i18n.ts';
export function BottomSheet({ name, open, title, onClose, children, shell }: BottomSheetProps) {
  const ref = useBottomSheet(open, onClose, shell);
  return (
    <section
      id={`${name}-sheet`}
      ref={ref}
      className="bottom-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${name}-title`}
      hidden={!open}
    >
      <div className="sheet-handle" aria-hidden="true" />
      <header className="sheet-heading">
        <div>
          {name === 'table' && <span className="eyebrow">{t('pockets')}</span>}
          <h2 id={`${name}-title`}>{title}</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={t(name === 'table' ? 'closeTable' : 'closeMenu')}
        >
          ×
        </button>
      </header>
      {children}
    </section>
  );
}
