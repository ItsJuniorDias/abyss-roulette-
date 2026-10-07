import { useCallback, useEffect, useRef, useMemo } from 'react';
import type { RefObject } from 'react';
import { chipFlight } from '../animations/board-motion.ts';
export function useBoardEffects(shell: RefObject<HTMLElement | null>) {
  const effects = useRef(new Set<Animation>()),
    elements = useRef(new Set<HTMLElement>());
  useEffect(() => {
    const animations = effects.current,
      nodes = elements.current;
    return () => {
      animations.forEach((a) => a.cancel());
      nodes.forEach((n) => n.remove());
      animations.clear();
      nodes.clear();
    };
  }, []);
  const animate = useCallback(
    (
      element: HTMLElement,
      frames: Keyframe[],
      options: KeyframeAnimationOptions,
      temporary = false,
    ) => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const animation = element.animate(frames, options);
      effects.current.add(animation);
      if (temporary) elements.current.add(element);
      const done = () => {
        effects.current.delete(animation);
        if (temporary) {
          element.remove();
          elements.current.delete(element);
        }
      };
      animation.onfinish = done;
      animation.oncancel = done;
    },
    [],
  );
  const chip = useCallback(
    (target: HTMLElement, amount: number, color: string) => {
      const root = shell.current,
        from = root?.querySelector<HTMLElement>(`.chip[data-v="${amount}"]`);
      if (!root || !from || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const source = from.getBoundingClientRect(),
        to = target.getBoundingClientRect(),
        bounds = root.getBoundingClientRect();
      const node = document.createElement('span');
      node.className = 'flying-chip';
      node.textContent = String(amount);
      node.style.background = color;
      node.setAttribute('aria-hidden', 'true');
      node.style.left = `${source.left + source.width / 2 - bounds.left - 12}px`;
      node.style.top = `${source.top + source.height / 2 - bounds.top - 12}px`;
      root.appendChild(node);
      animate(
        node,
        chipFlight(
          to.right - 13 - source.left - source.width / 2,
          to.top + to.height / 2 - source.top - source.height / 2,
        ),
        { duration: 360, easing: 'cubic-bezier(.2,.7,.25,1)' },
        true,
      );
      const ripple = document.createElement('span');
      ripple.className = 'bet-ripple';
      ripple.setAttribute('aria-hidden', 'true');
      target.appendChild(ripple);
      animate(
        ripple,
        [
          { transform: 'scale(.25)', opacity: 0.8 },
          { transform: 'scale(1.6)', opacity: 0 },
        ],
        { duration: 450, easing: 'ease-out' },
        true,
      );
      animate(target, [{ filter: 'brightness(1.65)' }, { filter: 'brightness(1)' }], {
        duration: 380,
        easing: 'ease-out',
      });
    },
    [shell, animate],
  );
  const clear = useCallback(() => {
    shell.current?.querySelectorAll<HTMLElement>('.chipmark').forEach((mark, i) => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const ghost = mark.cloneNode(true) as HTMLElement;
      ghost.classList.add('chip-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      mark.parentElement?.appendChild(ghost);
      animate(
        ghost,
        [
          { transform: 'translateY(-50%)', opacity: 1 },
          { transform: 'translateY(-35px) scale(.6)', opacity: 0 },
        ],
        { duration: 230, delay: Math.min(i * 15, 150), easing: 'ease-in' },
        true,
      );
    });
  }, [shell, animate]);
  const result = useCallback(
    (number: number) => {
      shell.current?.querySelectorAll<HTMLElement>('.cell[data-bet^="n"]').forEach((cell, i) => {
        if (cell.dataset.bet !== `n${number}`)
          animate(
            cell,
            [
              { boxShadow: 'inset 0 0 0 1px #f9e3aa80', filter: 'brightness(1.3)' },
              { boxShadow: 'inset 0 0 0 0px transparent', filter: 'brightness(1)' },
            ],
            { duration: 420, delay: i * 9, easing: 'ease-out' },
          );
      });
    },
    [shell, animate],
  );
  return useMemo(() => ({ chip, clear, result, animate }), [chip, clear, result, animate]);
}
