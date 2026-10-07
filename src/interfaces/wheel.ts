export interface BallMotion {
  id: string;
  idx: number;
  T: number;
  phiT: number;
  A: number;
  t: number;
  lastPocket: number;
  prevBeta: number;
  jitterSign: number;
  hitDeflector: boolean;
  bounce: number;
  settled: boolean;
}
