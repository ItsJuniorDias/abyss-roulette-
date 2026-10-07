export interface MascotElements {
  stage: HTMLDivElement;
  still: HTMLImageElement;
  canvas: HTMLCanvasElement;
  videos: HTMLVideoElement[];
}
export interface FrameWatch {
  stopped: boolean;
  frame?: number;
  paint?: number;
}
export interface Blend {
  next: HTMLVideoElement;
  previous: HTMLVideoElement | null;
  progress: number;
  resolve: (completed: boolean) => void;
  started: number | null;
}
