import { useEffect, useRef } from 'react';
import type { MascotState } from '../types/game.ts';
import { createMascotPlayer } from '../providers/mascot-player.ts';
export function useMascot(state: MascotState) {
  const stage = useRef<HTMLDivElement>(null),
    still = useRef<HTMLImageElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const a = useRef<HTMLVideoElement>(null),
    b = useRef<HTMLVideoElement>(null);
  const player = useRef<ReturnType<typeof createMascotPlayer> | null>(null);
  useEffect(() => {
    if (!stage.current || !still.current || !canvas.current || !a.current || !b.current) return;
    const instance = createMascotPlayer({
      stage: stage.current,
      still: still.current,
      canvas: canvas.current,
      videos: [a.current, b.current],
    });
    player.current = instance;
    return () => {
      instance.dispose();
      player.current = null;
    };
  }, []);
  useEffect(() => {
    player.current?.setState(state);
  }, [state]);
  return { stage, still, canvas, a, b };
}
