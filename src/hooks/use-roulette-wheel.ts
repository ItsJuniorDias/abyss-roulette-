import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createWorld } from '../providers/roulette-world.ts';
import { createBallMotion, ballPose } from '../animations/ball-motion.ts';
import { TIMING } from '../config/game.ts';
import { BALL_R, POCKET_R } from '../config/wheel.ts';
import { N, ORDER, SEG } from '../config/roulette.ts';
import { wrap, lerp, smooth } from '../utils/math.ts';
import type { GameStore } from '../stores/game-store.ts';
import type { AudioSession } from '../providers/audio-session.ts';
import type { RollingSound } from '../interfaces/audio.ts';
import type { BallMotion } from '../interfaces/wheel.ts';
export function useRouletteWheel(store: GameStore, audio: AudioSession) {
  const canvas = useRef<HTMLCanvasElement>(null),
    viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!canvas.current || !viewport.current) return;
    const canvasElement = canvas.current,
      container = viewport.current;
    let cancelled = false,
      cleanup: (() => void) | undefined;
    void (async () => {
      await Promise.race([
        document.fonts.load('700 80px Manrope').catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
      if (cancelled) return;
      try {
        const world = createWorld(canvasElement);
        const { renderer, scene, camera, rotor, ball, ballGlow } = world;
        const fog = scene.fog as THREE.Fog;
        const fogNear = fog.near,
          fogFar = fog.far,
          look = new THREE.Vector3(0, 0, 0.2),
          camPos = new THREE.Vector3();
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        let distScale = 1,
          focus = 0,
          shake = 0,
          rotorAng = 0,
          rotorVel = 0.3,
          spin: BallMotion | null = null,
          roll: RollingSound | null = null;
        let lastSpin = '',
          lastResult = '',
          contextLost = false;
        const resize = () => {
          const { width, height } = container.getBoundingClientRect(),
            w = Math.max(1, width),
            h = Math.max(1, height);
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.clearViewOffset();
          const span =
            2 * Math.hypot(7.4, 9.2) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
          distScale = Math.max(0.84, 9.8 / (span * camera.aspect), 6.6 / span);
          fog.near = fogNear * distScale;
          fog.far = fogFar * distScale;
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();
        const clock = new THREE.Clock();
        const onLost = (event: Event) => {
          event.preventDefault();
          contextLost = true;
          roll?.set(0, 0);
          store.getState().setRendererReady(false, 'rendererLost');
        };
        const onRestored = () => {
          contextLost = false;
          clock.getDelta();
          store.getState().setRendererReady(true);
        };
        canvasElement.addEventListener('webglcontextlost', onLost);
        canvasElement.addEventListener('webglcontextrestored', onRestored);
        renderer.setAnimationLoop(() => {
          const raw = clock.getDelta(),
            dt = Math.min(raw, 0.05),
            time = clock.elapsedTime,
            s = store.getState();
          if (contextLost) return;
          if (s.phase === 'spin' && s.round && s.round.id !== lastSpin) {
            lastSpin = s.round.id;
            spin = createBallMotion(
              lastSpin,
              ORDER.indexOf(s.round.pocket),
              s.resultIndex,
              rotorAng,
              TIMING.spinSeconds + Math.random() * TIMING.spinVariation,
              Math.random() < 0.5 ? -1 : 1,
            );
            audio.spinStart();
            roll = audio.rollLoop();
          }
          const target = spin ? 1.25 : 0.3;
          rotorVel += (target - rotorVel) * dt * 0.6;
          rotorAng += rotorVel * dt;
          rotor.rotation.y = rotorAng;
          if (spin) {
            spin.t = Math.min(spin.T, spin.t + raw);
            const { psi, r, y, u } = ballPose(spin),
              beta = psi - rotorAng;
            ball.position.set(Math.cos(beta) * r, y, Math.sin(beta) * r);
            const speed =
              Math.abs(wrap(beta - spin.prevBeta + Math.PI) - Math.PI) / Math.max(raw, 1e-3);
            spin.prevBeta = beta;
            const volume = u < 0.6 ? 0.9 : u < 0.72 ? 0.55 : (0.12 * (1 - u)) / 0.28;
            roll?.set(Math.min(speed / 14, 1) * volume, speed);
            if (!spin.hitDeflector && u >= 0.6 && r < 2.84) {
              spin.hitDeflector = true;
              audio.deflector();
            }
            if (u >= 0.72) {
              const k = (u - 0.72) / 0.28,
                contact = Math.floor(k * 5);
              if (contact > spin.bounce && contact < 5) {
                spin.bounce = contact;
                audio.ballHit(Math.max(0.15, Math.exp(-3 * k)));
              }
              const pocket = Math.round(wrap(psi) / SEG) % N;
              if (pocket !== spin.lastPocket && y < BALL_R + 0.05) audio.fret(0.12 + (1 - u) * 0.4);
              spin.lastPocket = pocket;
              if (!spin.settled && u > 0.92) {
                spin.settled = true;
                audio.settle();
              }
            }
            ballGlow.intensity = 1.5;
            focus = Math.min(1, focus + dt * 0.6);
            if (spin.t >= spin.T) {
              const id = spin.id;
              spin = null;
              roll?.stop();
              roll = null;
              s.finishSpin(id);
            }
          } else {
            const beta = s.resultIndex * SEG - rotorAng;
            ball.position.set(Math.cos(beta) * POCKET_R, BALL_R, Math.sin(beta) * POCKET_R);
            ballGlow.intensity = Math.max(0, ballGlow.intensity - dt);
            focus = Math.max(0, focus - dt * 0.4);
          }
          if (s.phase === 'result' && s.round && s.round.id !== lastResult) {
            lastResult = s.round.id;
            if (s.round.payout > s.round.staked && !reduced.matches) {
              shake = 0.035;
              world.fireBurst(
                ball.getWorldPosition(new THREE.Vector3()),
                s.round.payout >= s.round.staked * 10 ? 1.3 : 0.7,
              );
            }
          }
          const sway = reduced.matches ? 0 : Math.sin(time * 0.17) * 0.18,
            d = distScale * lerp(1, 0.97, smooth(focus));
          camPos.set(
            Math.sin(sway) * 9.2 * d,
            lerp(7.4, 6.6, smooth(focus)) * d,
            Math.cos(sway) * 9.2 * d,
          );
          if (shake > 0) {
            camPos.x += (Math.random() - 0.5) * shake;
            camPos.y += (Math.random() - 0.5) * shake;
            shake = Math.max(0, shake - dt * 0.9);
          }
          camera.position.copy(camPos);
          camera.lookAt(look);
          world.update(dt);
          renderer.render(scene, camera);
        });
        cleanup = () => {
          observer.disconnect();
          canvasElement.removeEventListener('webglcontextlost', onLost);
          canvasElement.removeEventListener('webglcontextrestored', onRestored);
          roll?.stop();
          world.dispose();
        };
        store.getState().setRendererReady(true);
      } catch {
        store.getState().setRendererReady(false, 'rendererFailed');
      }
    })();
    return () => {
      cancelled = true;
      cleanup?.();
      store.getState().setRendererReady(false);
    };
  }, [store, audio]);
  return { canvas, viewport };
}
