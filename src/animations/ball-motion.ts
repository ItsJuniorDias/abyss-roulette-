import { BOWL, BALL_R, TRACK_R, POCKET_R } from '../config/wheel.ts';
import { SEG } from '../config/roulette.ts';
import { TIMING } from '../config/game.ts';
import { wrap, TAU, lerp, smooth } from '../utils/math.ts';
import type { BallMotion } from '../interfaces/wheel.ts';
export function bowlY(r: number) {
  if (r <= 2.42) return 0;
  for (let i = 0; i < 4; i++) {
    const [r0, y0] = BOWL[i],
      [r1, y1] = BOWL[i + 1];
    if (r <= r1) return y0 + ((y1 - y0) * (r - r0)) / (r1 - r0);
  }
  return 0.44;
}
export function createBallMotion(
  id: string,
  index: number,
  previousIndex: number,
  rotorAngle: number,
  duration: number = TIMING.spinSeconds,
  jitterSign: number = 1,
): BallMotion {
  const phiT = index * SEG,
    psi0 = previousIndex * SEG;
  return {
    id,
    idx: index,
    T: duration,
    phiT,
    A: wrap(phiT - psi0) + TAU * 7,
    t: 0,
    lastPocket: -1,
    prevBeta: wrap(psi0 - rotorAngle),
    jitterSign,
    hitDeflector: false,
    bounce: -1,
    settled: false,
  };
}
export function ballPose(s: BallMotion) {
  const u = Math.min(s.t / s.T, 1);
  let psi = s.phiT - s.A * Math.pow(1 - u, 2.4);
  let r, y;

  if (u < 0.05) {
    // launch from pocket up to the track
    const k = smooth(u / 0.05);
    r = lerp(POCKET_R, TRACK_R, k);
    y = lerp(BALL_R, bowlY(TRACK_R) + BALL_R, k) + Math.sin(k * Math.PI) * 0.45;
  } else if (u < 0.6) {
    // riding the track
    r = TRACK_R + Math.sin(s.t * 9) * 0.01;
    y = bowlY(r) + BALL_R;
  } else if (u < 0.72) {
    // falling down the bowl, clipping a deflector
    const k = (u - 0.6) / 0.12;
    r = lerp(TRACK_R, 2.08, k * k);
    y = Math.max(bowlY(r), 0) + BALL_R + 0.16 * Math.exp(-(((r - 2.78) / 0.07) ** 2));
  } else {
    // bouncing across the pockets
    const k = (u - 0.72) / 0.28;
    const decay = Math.exp(-5 * k);
    r = POCKET_R + 0.28 * decay * Math.abs(Math.cos(k * Math.PI * 4));
    y = BALL_R + 0.24 * decay * Math.abs(Math.sin(k * Math.PI * 5));
    psi += s.jitterSign * SEG * 1.3 * Math.sin(k * Math.PI * 3.2) * (1 - k) ** 2;
  }
  return { psi, r, y, u };
}
