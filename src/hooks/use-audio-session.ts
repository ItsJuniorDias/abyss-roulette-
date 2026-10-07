import { useEffect, useState } from 'react';
import { ASSETS } from '../config/assets.ts';
import { createAudioSession } from '../providers/audio-session.ts';
import type { AudioSession } from '../providers/audio-session.ts';
export function useAudioSession() {
  const [audio, setAudio] = useState<AudioSession | null>(null);
  useEffect(() => {
    const music = document.createElement('audio');
    music.id = 'lounge-music';
    music.src = ASSETS.music;
    music.preload = 'none';
    music.loop = true;
    music.setAttribute('aria-hidden', 'true');
    document.body.appendChild(music);
    const session = createAudioSession(music);
    setAudio(session);
    const start = () => {
      try {
        session.start();
      } catch {
        /* Audio support must not prevent play. */
      }
    };
    const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
    events.forEach((event) =>
      window.addEventListener(event, start, { capture: true, passive: true }),
    );
    return () => {
      events.forEach((event) => window.removeEventListener(event, start, true));
      session.dispose();
    };
  }, []);
  return audio;
}
