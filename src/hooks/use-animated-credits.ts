import { useEffect, useState, useRef } from 'react';
export function useAnimatedCredits(value: number) {
  const [shown, setShown] = useState(value),
    current = useRef(value);
  useEffect(() => {
    if (value <= current.current || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = value;
      setShown(value);
      return;
    }
    const from = current.current,
      start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      current.current = Math.floor(from + (value - from) * (1 - (1 - t) ** 3));
      setShown(current.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}
