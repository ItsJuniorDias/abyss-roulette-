import * as THREE from 'three';
import './style.css';
import { ORDER, N, SEG, BETS, colorOf, secureIndex } from './rules.js';
import { createWorld, bowlY, BALL_R, TRACK_R, POCKET_R } from './scene.js';
import * as sfx from './audio.js';

// Make sure the wheel numbers are drawn with the right font.
await Promise.race([document.fonts.load('700 88px Oswald'), new Promise((r) => setTimeout(r, 1500))]);

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const wrap = (a) => ((a % TAU) + TAU) % TAU;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

const world = createWorld($('gl'));
const { renderer, scene, camera, rotor, ball, ballGlow } = world;

// optional generated backdrop
const bgImg = new Image();
bgImg.onload = () => { $('bg').style.backgroundImage = `url(${bgImg.src})`; $('bg').classList.add('img'); };
bgImg.src = `${import.meta.env.BASE_URL}assets/background.png`;

// ---------------- game state ----------------
const state = {
  phase: 'bet', // bet | spin | result
  balance: 1000,
  chip: 5,
  bets: {},
  lastBets: {},
  history: [],
  resultIdx: 0, // index in ORDER where the ball rests
};

let rotorAng = 0, rotorVel = 0.3, rotorTarget = 0.3;
let spin = null; // active spin parameters
let roll = null; // rolling-noise handle
let shake = 0;

// ---------------- ball trajectory ----------------
// psi = ball angle relative to the rotor. Pocket i sits at psi = i*SEG.
// World angle of the ball: beta = psi - rotorAng.
// psi eases from (target + A) to target, so the ball always lands on the
// pre-drawn result while looking like free motion.
function startSpin() {
  const idx = secureIndex(); // NOTE: in production this comes from the server
  const T = 8.5 + Math.random() * 1.5;
  const phiT = idx * SEG;
  const beta0 = wrap(state.resultIdx * SEG - rotorAng); // where the ball currently is
  const A = wrap(beta0 + rotorAng - phiT) + TAU * 7;
  spin = {
    idx, T, phiT, A, t: 0, lastPocket: -1, prevBeta: beta0, jitterSign: Math.random() < 0.5 ? -1 : 1,
    hitDeflector: false, bounce: -1, settled: false,
  };
  rotorTarget = 1.25;
  state.phase = 'spin';
  sfx.spinStart();
  roll = sfx.rollLoop();
}

function ballPose(s) {
  const u = Math.min(s.t / s.T, 1);
  let psi = s.phiT + s.A * Math.pow(1 - u, 2.4);
  let r, y;

  if (u < 0.05) { // launch from pocket up to the track
    const k = smooth(u / 0.05);
    r = lerp(POCKET_R, TRACK_R, k);
    y = lerp(BALL_R, bowlY(TRACK_R) + BALL_R, k) + Math.sin(k * Math.PI) * 0.45;
  } else if (u < 0.6) { // riding the track
    r = TRACK_R + Math.sin(s.t * 9) * 0.01;
    y = bowlY(r) + BALL_R;
  } else if (u < 0.72) { // falling down the bowl, clipping a deflector
    const k = (u - 0.6) / 0.12;
    r = lerp(TRACK_R, 2.08, k * k);
    y = Math.max(bowlY(r), 0) + BALL_R + 0.16 * Math.exp(-(((r - 2.78) / 0.07) ** 2));
  } else { // bouncing across the pockets
    const k = (u - 0.72) / 0.28;
    const decay = Math.exp(-5 * k);
    r = POCKET_R + 0.28 * decay * Math.abs(Math.cos(k * Math.PI * 4));
    y = BALL_R + 0.24 * decay * Math.abs(Math.sin(k * Math.PI * 5));
    psi += s.jitterSign * SEG * 1.3 * Math.sin(k * Math.PI * 3.2) * (1 - k) ** 2;
  }
  return { psi, r, y, u };
}

function placeBall(beta, r, y) {
  ball.position.set(Math.cos(beta) * r, y, Math.sin(beta) * r);
}

function finishSpin() {
  const n = ORDER[spin.idx];
  state.resultIdx = spin.idx;
  spin = null;
  rotorTarget = 0.3;
  roll?.stop(); roll = null;

  const staked = Object.values(state.bets).reduce((a, b) => a + b, 0);
  let won = 0;
  for (const [k, amt] of Object.entries(state.bets)) if (BETS[k].win(n)) won += amt * (BETS[k].pay + 1);
  state.balance += won;
  if (staked) state.lastBets = { ...state.bets };
  state.bets = {};
  state.history.unshift(n);
  state.history.length = Math.min(state.history.length, 12);

  showResult(n, won, staked);
  state.phase = 'result';
  setTimeout(() => { state.phase = 'bet'; msg(''); render(); }, 1600);
  render();
}

// ---------------- result FX ----------------
const WIN_SFX = ['KRA-THOOM!', 'SKRAKK!', 'BWOOOM!', 'KZZAKT!', 'DOOOM!'];
const LOSE_SFX = ['thunk.', '...krrk', 'tok.'];
let bannerTimer;

function showResult(n, won, staked) {
  const net = won - staked;
  const banner = $('banner');
  $('sfx').textContent = won > 0 ? WIN_SFX[Math.floor(Math.random() * WIN_SFX.length)] : LOSE_SFX[Math.floor(Math.random() * LOSE_SFX.length)];
  $('sfx').style.fontSize = won > 0 ? '' : '48px';
  $('bnum').textContent = n;
  $('bnum').className = 'num ' + colorOf(n);
  $('bsub').textContent = !staked ? `${n} · ${colorOf(n).toUpperCase()}` : won > 0 ? `+${won}` : `THE HOUSE THANKS YOU · ${net}`;
  banner.classList.remove('hidden', 'show'); void banner.offsetWidth; banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => banner.classList.add('hidden'), 3200);

  document.querySelectorAll('.cell.hit').forEach((c) => c.classList.remove('hit'));
  document.querySelectorAll(`.cell[data-bet="n${n}"]`).forEach((c) => c.classList.add('hit'));

  const big = won > 0 && won >= staked * 10;
  sfx.result(won > 0 ? (big ? 'bigwin' : 'win') : 'lose');
  if (won > 0) {
    shake = 0.35 + Math.min(won / 400, 0.5);
    world.fireBurst(ball.getWorldPosition(new THREE.Vector3()), big ? 1.6 : 1);
    sfx.ember(big ? 1.3 : 1);
    flash(0.55);
  } else {
    shake = 0.08;
    flash(0.15);
  }
}

function flash(v) {
  const f = $('flash');
  f.animate([{ opacity: v }, { opacity: 0 }], { duration: 600, easing: 'steps(6)' });
}

// ---------------- betting board ----------------
const board = $('board');
function cell(key, text, cls, col, row, colSpan = 1, rowSpan = 1) {
  const el = document.createElement('div');
  el.className = `cell ${cls}`;
  el.dataset.bet = key;
  el.textContent = text;
  el.style.gridColumn = `${col} / span ${colSpan}`;
  el.style.gridRow = `${row} / span ${rowSpan}`;
  board.appendChild(el);
}
cell('n0', '0', 'green', 1, 1, 1, 3);
for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) {
  const n = c * 3 + (3 - r);
  cell('n' + n, String(n), colorOf(n), c + 2, r + 1);
}
for (let r = 0; r < 3; r++) cell('c' + (3 - r), '2:1', 'out', 14, r + 1);
for (let k = 1; k <= 3; k++) cell('d' + k, BETS['d' + k].label, 'out', 2 + (k - 1) * 4, 4, 4);
['low', 'even', 'red', 'black', 'odd', 'high'].forEach((k, i) => cell(k, BETS[k].label, `out ${k === 'red' || k === 'black' ? k : ''}`, 2 + i * 2, 5, 2));

board.addEventListener('click', (e) => {
  const el = e.target.closest('.cell'); if (!el) return;
  if (state.phase === 'spin') return msg('No more bets!', true);
  if (state.balance < state.chip) return msg('Not enough balance for that chip.', true);
  state.balance -= state.chip;
  state.bets[el.dataset.bet] = (state.bets[el.dataset.bet] || 0) + state.chip;
  sfx.chip(); msg(''); render();
});
board.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const el = e.target.closest('.cell'); if (!el || state.phase === 'spin') return;
  const amt = state.bets[el.dataset.bet]; if (!amt) return;
  state.balance += amt; delete state.bets[el.dataset.bet];
  sfx.uiClick(); render();
});

// chips
const CHIPS = [[1, '#2b6b60'], [5, '#b3191c'], [25, '#1b1514'], [100, '#a8741e']];
CHIPS.forEach(([v, color]) => {
  const b = document.createElement('button');
  b.className = 'chip'; b.textContent = v; b.style.background = color; b.dataset.v = v;
  b.onclick = () => { state.chip = v; sfx.uiClick(); render(); };
  $('chips').appendChild(b);
});

$('clear').onclick = () => {
  if (state.phase === 'spin') return;
  const refund = Object.values(state.bets).reduce((a, b) => a + b, 0);
  if (!refund) return sfx.uiClick();
  state.balance += refund;
  state.bets = {}; sfx.sweep(); render();
};
$('repeat').onclick = () => {
  if (state.phase === 'spin') return;
  const cost = Object.values(state.lastBets).reduce((a, b) => a + b, 0);
  if (!cost) return msg('No previous bet.', true);
  if (cost > state.balance) return msg('Not enough balance to rebet.', true);
  for (const [k, v] of Object.entries(state.lastBets)) state.bets[k] = (state.bets[k] || 0) + v;
  state.balance -= cost; sfx.chip(); render();
};
$('spin').onclick = trySpin;
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); trySpin(); }
  if (e.code === 'KeyM') toggleSound();
});

// audio can only start after a user gesture
window.addEventListener('pointerdown', () => sfx.start());
window.addEventListener('keydown', () => sfx.start());

$('mute').onclick = toggleSound;
function toggleSound() {
  sfx.start();
  sfx.toggleMute();
  renderMute();
}
function renderMute() {
  const m = sfx.isMuted();
  $('mute').querySelector('b').textContent = m ? 'OFF' : 'ON';
  $('mute').setAttribute('aria-pressed', String(m));
}
renderMute();

function trySpin() {
  if (state.phase !== 'bet') return;
  if (!Object.keys(state.bets).length) return msg('Place a bet first.', true);
  msg('No more bets…');
  document.querySelectorAll('.cell.hit').forEach((c) => c.classList.remove('hit'));
  $('banner').classList.add('hidden');
  startSpin(); render();
}

function msg(text, warn = false) {
  $('msg').textContent = text || 'Pick a chip and click the table · right-click removes';
  $('msg').classList.toggle('warn', warn);
}

function render() {
  $('balance').textContent = state.balance;
  $('staked').textContent = Object.values(state.bets).reduce((a, b) => a + b, 0);
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('sel', +c.dataset.v === state.chip));
  document.querySelectorAll('.cell').forEach((el) => {
    let mark = el.querySelector('.chipmark');
    const amt = state.bets[el.dataset.bet];
    if (amt) {
      if (!mark) { mark = document.createElement('span'); mark.className = 'chipmark'; el.appendChild(mark); }
      mark.textContent = amt;
    } else mark?.remove();
  });
  $('spin').disabled = state.phase !== 'bet';
  $('history').innerHTML = state.history.map((n) => `<div class="h ${colorOf(n)}">${n}</div>`).join('');
}
render();

// ---------------- camera / resize ----------------
const look = new THREE.Vector3(0, 0, 0.2);
let distScale = 1, focus = 0;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const panelH = $('panel').getBoundingClientRect().height;
  const topH = 70;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // push the wheel into the free space between header and betting panel
  camera.setViewOffset(w, h, 0, (panelH - topH) / 2, w, h);
  const availAspect = w / Math.max(h - panelH - topH, 200);
  distScale = Math.min(Math.max(1.45 / availAspect, 1) * Math.max(1, 620 / (h - panelH)), 2.6);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------- loop ----------------
const clock = new THREE.Clock();
const camPos = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05); // smoothing for visuals
  const spinDt = Math.min(raw, 0.25); // the round runs on wall-clock time, even on slow devices
  const time = clock.elapsedTime;

  rotorVel += (rotorTarget - rotorVel) * dt * 0.6;
  rotorAng += rotorVel * dt;
  rotor.rotation.y = rotorAng;

  if (spin) {
    spin.t += spinDt;
    const { psi, r, y, u } = ballPose(spin);
    const beta = psi - rotorAng;
    placeBall(beta, r, y);

    // rolling sound follows ball speed: loud on the track, fading as it drops
    const speed = Math.abs(wrap(beta - spin.prevBeta + Math.PI) - Math.PI) / Math.max(spinDt, 1e-3);
    spin.prevBeta = beta;
    const phaseVol = u < 0.6 ? 0.9 : u < 0.72 ? 0.55 : 0.12 * (1 - u) / 0.28;
    roll?.set(Math.min(speed / 14, 1) * phaseVol, speed);

    // the ball clips a diamond deflector on the way down
    if (!spin.hitDeflector && u >= 0.6 && r < 2.84) { spin.hitDeflector = true; sfx.deflector(); }

    // one hit per bounce contact (ballPose bounces touch down at k = 0, .2, .4, .6, .8)
    if (u >= 0.72) {
      const k = (u - 0.72) / 0.28;
      const contact = Math.floor(k * 5);
      if (contact > spin.bounce && contact < 5) { spin.bounce = contact; sfx.ballHit(Math.max(0.15, Math.exp(-3 * k))); }

      // light ticks while the ball skims low over the frets
      const pocket = Math.round(wrap(psi) / SEG) % N;
      if (pocket !== spin.lastPocket && y < BALL_R + 0.05) sfx.fret(0.12 + (1 - u) * 0.4);
      spin.lastPocket = pocket;

      if (!spin.settled && u > 0.92) { spin.settled = true; sfx.settle(); }
    }

    ballGlow.intensity = 1.5;
    focus = Math.min(1, focus + dt * 0.6);
    if (spin.t >= spin.T) finishSpin();
  } else {
    placeBall(state.resultIdx * SEG - rotorAng, POCKET_R, BALL_R);
    ballGlow.intensity = Math.max(0, ballGlow.intensity - dt);
    focus = Math.max(0, focus - dt * 0.4);
  }

  // camera: slow sway, dolly in while spinning, ink-panel shake on wins
  const sway = Math.sin(time * 0.17) * 0.18;
  const d = distScale * lerp(1, 0.86, smooth(focus));
  camPos.set(Math.sin(sway) * 9.2 * d, lerp(7.4, 6.6, smooth(focus)) * d, Math.cos(sway) * 9.2 * d);
  if (shake > 0) {
    camPos.x += (Math.random() - 0.5) * shake; camPos.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 0.9);
  }
  camera.position.copy(camPos);
  camera.lookAt(look);

  world.update(dt, time);
  renderer.render(scene, camera);
});
