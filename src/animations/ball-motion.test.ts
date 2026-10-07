import { expect, it } from 'vitest';
import { ballPose, createBallMotion } from './ball-motion.ts';
import { N, SEG } from '../config/roulette.ts';
import { BALL_R, POCKET_R } from '../config/wheel.ts';

it('lands on every supplied pocket independently of visual randomness and frame rate', () => {
  for (let index = 0; index < N; index++) {
    const motion = createBallMotion(`round-${index}`, index, (index + 11) % N, 1.4);
    for (const fraction of [0, 0.01, 0.05, 0.3, 0.6, 0.72, 0.9, 1, 2]) {
      motion.t = motion.T * fraction;
      const pose = ballPose(motion);
      expect(Object.values(pose).every(Number.isFinite)).toBe(true);
      expect(pose.y).toBeGreaterThanOrEqual(BALL_R - 0.0001);
      if (fraction >= 1) {
        expect(pose.psi).toBeCloseTo(index * SEG, 10);
        expect(pose.r).toBeCloseTo(POCKET_R, 2);
        expect(pose.y).toBeCloseTo(BALL_R, 10);
      }
    }
  }
});
