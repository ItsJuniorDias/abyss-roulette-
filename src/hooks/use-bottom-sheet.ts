import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
export function useBottomSheet(
  open: boolean,
  onClose: () => void,
  shell: RefObject<HTMLElement | null>,
) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const sheet = ref.current,
      root = shell.current;
    if (!open || !sheet || !root) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = [...root.children].filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && el !== sheet && el.id !== 'sheet-backdrop',
    );
    siblings.forEach((el) => {
      el.inert = true;
    });
    sheet.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = [
        ...sheet.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]'),
      ].filter((el) => !el.hidden);
      const first = nodes[0],
        last = nodes.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      siblings.forEach((el) => {
        el.inert = false;
      });
      trigger?.focus();
    };
  }, [open, onClose, shell]);
  return ref;
}
