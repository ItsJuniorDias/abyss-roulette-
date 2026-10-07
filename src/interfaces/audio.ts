export type AudioBus = 'music' | 'sfx';
export interface AudioAsset {
  file: string;
  sha256?: string;
  loop?: [number, number];
}
export type AudioManifest = Record<string, AudioAsset>;
export interface SoundOptions {
  vol?: number;
  rate?: number;
  to?: AudioBus;
  delay?: number;
  fadeIn?: number;
}
export interface RollingSound {
  set(intensity: number, speed: number): void;
  stop(): void;
}
