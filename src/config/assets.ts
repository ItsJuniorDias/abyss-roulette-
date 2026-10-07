const base = import.meta.env?.BASE_URL ?? '/';
export const ASSETS = {
  mascot: `${base}animations/ai/mascot-v1/`,
  poster: `${base}animations/ai/mascot-v1/poster.png`,
  audio: `${base}audio/`,
  music: `${base}audio/music_lounge.mp3`,
  backdrop: `${base}assets/luxury/lounge-portrait-v2.png`,
} as const;
