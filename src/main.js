import * as THREE from 'three';
import './style.css';
import { ORDER, N, SEG, BETS, colorOf, secureIndex } from './rules.js';
import { createWorld, bowlY, BALL_R, TRACK_R, POCKET_R } from './scene.js';
import * as sfx from './audio.js';
import { chipArrival, clearTableEffect, resultSweep } from './board-effects.js';
import { setMascotState } from './mascot.js';
import { closeSheet } from './table-ui.js';

// Make sure the wheel numbers are drawn with the right font.
await Promise.race([document.fonts.load('700 80px Manrope').catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const wrap = (a) => ((a % TAU) + TAU) % TAU;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const formatCredits = (value) => new Intl.NumberFormat('en-US').format(value);
const colorName = colorOf;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const world = createWorld($('gl'));
const { renderer, scene, camera, rotor, ball, ballGlow } = world;

// ---------------- game state ----------------
const START_BALANCE = 1000;
const SAVE_KEY = 'aurum-club:save';
const LEGACY_SAVE_KEY = 'abyss-roulette:save';
const CHIPS = [[1, '#147555'], [5, '#9e2435'], [25, '#131c1a'], [100, '#9d7737']];
const MIN_CHIP = CHIPS[0][0];

const saved = (() => {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY));
    if (!s || !Number.isFinite(s.balance) || s.balance < 0) return null;
    const lastBets = Object.fromEntries(Object.entries(s.lastBets || {}).filter(([k, v]) => BETS[k] && v > 0));
    const history = (s.history || []).filter((n) => Number.isInteger(n) && n >= 0 && n <= 36).slice(0, 12);
    return { balance: Math.floor(s.balance), lastBets, history };
  } catch { return null; }
})();

const state = {
  phase: 'bet', // bet | spin | result
  balance: saved?.balance ?? START_BALANCE,
  chip: 5,
  bets: {},
  lastBets: saved?.lastBets ?? {},
  undo: [], // stack of chip placements: [[betKey, amount], ...]
  history: saved?.history ?? [],
  resultIdx: 0, // index in ORDER where the ball rests
};

// Stakes on the table count as bankroll, except during a spin, so reloading mid-spin can't undo a loss.
function save() {
  const balance = state.balance + (state.phase === 'spin' ? 0 : sum(state.bets));
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ balance, lastBets: state.lastBets, history: state.history })); } catch { /* storage blocked */ }
}

let rotorAng = 0, rotorVel = 0.3, rotorTarget = 0.3;
let countUp = false; // winnings count up on the HUD instead of jumping
let resultTimer;
let spin = null; // active spin parameters
let roll = null; // rolling-noise handle
let shake = 0;

// ---------------- ball trajectory ----------------
// psi = ball angle relative to the rotor. Pocket i sits at psi = i*SEG.
// World angle of the ball: beta = psi - rotorAng.
// psi rises from (target - A) to target, so the ball always lands on the pre-drawn
// result while looking like free motion. Its world speed is dpsi/dt - rotorVel: it runs
// against the rotor, like a real croupier's throw, until it slows down and gets carried along.
function startSpin() {
  const idx = secureIndex(); // NOTE: in production this comes from the server
  const T = 8.5 + Math.random() * 1.5;
  const phiT = idx * SEG;
  const psi0 = state.resultIdx * SEG; // where the ball currently rests
  const A = wrap(phiT - psi0) + TAU * 7;
  spin = {
    idx, T, phiT, A, t: 0, lastPocket: -1, prevBeta: wrap(psi0 - rotorAng), jitterSign: Math.random() < 0.5 ? -1 : 1,
    hitDeflector: false, bounce: -1, settled: false,
  };
  rotorTarget = 1.25;
  state.phase = 'spin';
  setMascotState('spin');
  $('host-message').textContent = 'The wheel is in motion.';
  $('host-eyebrow').textContent = 'NO MORE BETS';
  sfx.spinStart();
  roll = sfx.rollLoop();
}

function ballPose(s) {
  const u = Math.min(s.t / s.T, 1);
  let psi = s.phiT - s.A * Math.pow(1 - u, 2.4);
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

  const staked = sum(state.bets);
  const winners = Object.keys(state.bets).filter((k) => BETS[k].win(n));
  const won = winners.reduce((a, k) => a + state.bets[k] * (BETS[k].pay + 1), 0);
  state.balance += won;
  if (won) countUp = true;
  state.lastBets = { ...state.bets };
  state.bets = {};
  state.undo = [];
  state.history.unshift(n);
  state.history.length = Math.min(state.history.length, 12);
  state.phase = 'result';
  setMascotState(won > staked ? 'win' : won === staked ? 'idle' : 'loss');
  $('host-eyebrow').textContent = 'ROUND COMPLETE';
  $('host-message').textContent = won > staked ? 'A golden moment.' : 'The round is complete.';
  msg('Round complete.');

  showResult(n, won, staked, winners);
  clearTimeout(resultTimer);
  resultTimer = setTimeout(() => {
    state.phase = 'bet'; // One-shot video returns to idle on its own ended event.
    $('host-eyebrow').textContent = 'PLACE YOUR BETS';
    $('host-message').textContent = 'A table of your own.';
    msg(''); render();
  }, 5250);
  render();
}

// ---------------- result FX ----------------
const WIN_SFX = ['What a show!', 'A winning touch.', 'Magnificent!'];
const LOSE_SFX = ['Round result'];
let bannerTimer;

function showResult(n, won, staked, winners) {
  const banner = $('banner');
  $('sfx').textContent = won > staked ? pick(WIN_SFX) : won ? 'ROUND PAYOUT' : pick(LOSE_SFX);
  $('sfx').classList.toggle('lose', won <= staked);
  $('bnum').textContent = n;
  $('bnum').className = 'num ' + colorOf(n);
  $('bsub').textContent = won > 0 ? `+${formatCredits(won)} CREDITS` : `ROUND COMPLETE · −${formatCredits(staked)}`;
  banner.classList.toggle('loss', won === 0);
  banner.classList.remove('hidden', 'show'); void banner.offsetWidth; banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { banner.classList.add('hidden'); }, 5250);

  clearMarks();
  document.querySelectorAll(`.cell[data-bet="n${n}"]`).forEach((c) => c.classList.add('hit'));
  resultSweep(n);
  winners.forEach((k) => document.querySelectorAll(`.cell[data-bet="${k}"]`).forEach(el => el.classList.add('won')));

  $('sr').textContent = `${n} ${colorName(n)}. ` + (won > 0 ? `Payout of ${formatCredits(won)} credits.` : `You lost ${formatCredits(staked)} credits.`) + ` Balance ${formatCredits(state.balance)}.`;

  const big = won > 0 && won >= staked * 10;
  sfx.result(won > staked ? (big ? 'bigwin' : 'win') : 'lose');
  const motion = reduceMotion.matches ? 0 : 1;
  if (won > staked) {
    shake = 0.035 * motion;
    if (motion) world.fireBurst(ball.getWorldPosition(new THREE.Vector3()), big ? 1.3 : .7);
    if (motion) flash(0.14);
  } else {
    shake = 0;
  }
}

function flash(v) {
  const calm = reduceMotion.matches;
  $('flash').animate([{ opacity: calm ? v * 0.35 : v }, { opacity: 0 }], { duration: calm ? 900 : 600, easing: 'ease-out' });
}

const clearMarks = () => document.querySelectorAll('.cell.hit, .cell.won').forEach((c) => c.classList.remove('hit', 'won'));

// ---------------- betting board ----------------
// Each cell knows its spot in the wide (desktop) layout and the tall (phone) layout.
const board = $('board');
const cells = [];
function cell(key, text, cls, wide, tall, aria) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `cell ${cls}`;
  el.dataset.bet = key;
  el.textContent = text;
  el.tabIndex = 0;
  el.addEventListener('pointerdown', () => { if (state.phase !== 'spin' && !reduceMotion.matches) el.animate([{ transform: 'scale(.95)' }, { transform: 'scale(1)' }], { duration: 160 }); });
  el.setAttribute('role', 'button');
  el.dataset.aria = `${aria}, pays ${BETS[key].pay} to 1`;
  board.appendChild(el);
  cells.push({ el, wide, tall });
}
// [col, row, colSpan, rowSpan]
cell('n0', '0', 'green', [1, 1, 1, 3], [3, 1, 3, 1], 'Zero');
for (let n = 1; n <= 36; n++) {
  const c = Math.ceil(n / 3) - 1, r = (n - 1) % 3; // c: 0..11 along the table, r: 0 = bottom row (1, 4, 7…)
  cell('n' + n, String(n), colorOf(n), [c + 2, 3 - r, 1, 1], [r + 3, c + 2, 1, 1], `${n} ${colorName(n)}`);
}
for (let k = 1; k <= 3; k++) cell('c' + k, '2:1', 'out', [14, 4 - k, 1, 1], [k + 2, 14, 1, 1], `Column ${k}`);
for (let k = 1; k <= 3; k++) cell('d' + k, BETS['d' + k].label, 'out dz', [2 + (k - 1) * 4, 4, 4, 1], [2, 2 + (k - 1) * 4, 1, 4], `${BETS['d' + k].label}`);
['low', 'even', 'red', 'black', 'odd', 'high'].forEach((k, i) =>
  cell(k, BETS[k].label, `out ${k === 'red' || k === 'black' ? k : ''}`, [2 + i * 2, 5, 2, 1], [1, 2 + i * 2, 1, 2], BETS[k].label));

const quickBoard = $('quick-board');
for (const key of ['red', 'black', 'low', 'even', 'odd', 'high', 'd1', 'd2', 'd3']) {
  const el = document.createElement('button'); el.type = 'button';
  el.className = `cell ${key === 'red' || key === 'black' ? key : 'out'}`;
  el.dataset.bet = key; el.textContent = BETS[key].label;
  el.dataset.aria = `${BETS[key].label}, pays ${BETS[key].pay} to 1`;
  quickBoard.append(el); cells.push({ el });
}
const tallQuery = { matches: true, addEventListener() {} };
function layoutBoard() {
  const tall = tallQuery.matches;
  board.classList.toggle('tall', tall);
  for (const c of cells) {
    if (!c.tall) continue;
    const [col, row, cs, rs] = tall ? c.tall : c.wide;
    c.el.style.gridColumn = `${col} / span ${cs}`;
    c.el.style.gridRow = `${row} / span ${rs}`;
  }
}
tallQuery.addEventListener('change', () => { layoutBoard(); resize(); });
layoutBoard();

function placeBet(key, trigger) {
  if (state.phase !== 'bet') return msg('The round is still in progress.', true);
  if (state.balance < state.chip) return msg(state.balance < MIN_CHIP ? 'Out of credits. Use + CREDITS to refill.' : 'Not enough credits for this chip.', true);
  state.balance -= state.chip;
  state.bets[key] = (state.bets[key] || 0) + state.chip;
  state.undo.push([[key, state.chip]]);
  chipArrival(trigger || document.querySelector(`.cell[data-bet="${key}"]`), state.chip, chipColor(state.chip));
  if (state.phase === 'bet') clearMarks();
  sfx.chip(); msg(''); render();
}

function removeBet(key) {
  if (state.phase !== 'bet') return;
  const amt = state.bets[key]; if (!amt) return;
  state.balance += amt; delete state.bets[key];
  sfx.uiClick(); render();
}

function undo() {
  if (state.phase !== 'bet') return;
  const step = state.undo.pop();
  if (!step) return msg('No bets to undo.', true);
  for (const [k, amt] of step) {
    const take = Math.min(state.bets[k] || 0, amt); // the cell may have been cleared since
    state.bets[k] -= take; state.balance += take;
    if (!state.bets[k]) delete state.bets[k];
  }
  sfx.uiClick(); msg(''); render();
}

for (const surface of [board, quickBoard]) {
  surface.addEventListener('click', event => {
    const el = event.target.closest('.cell'); if (el) placeBet(el.dataset.bet, el);
  });
  surface.addEventListener('contextmenu', event => {
    const el = event.target.closest('.cell'); if (!el) return;
    event.preventDefault(); removeBet(el.dataset.bet);
  });
  surface.addEventListener('keydown', event => {
    const el = event.target.closest('.cell'); if (!el) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault(); event.stopPropagation(); removeBet(el.dataset.bet);
    }
  });
}

// chips
CHIPS.forEach(([v, color], i) => {
  const b = document.createElement('button');
  b.className = 'chip'; b.textContent = v; b.style.background = color; b.dataset.v = v;
  b.setAttribute('aria-label', `Chip ${v}`); b.title = `Chip ${v} (${i + 1})`;
  b.onclick = () => selectChip(v);
  b.addEventListener('pointerdown', () => { if (!reduceMotion.matches) b.animate([{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 180 }); });
  $('chips').appendChild(b);
});
function selectChip(v) { state.chip = v; sfx.uiClick(); render(); }
const chipColor = (amt) => [...CHIPS].reverse().find(([v]) => amt >= v)[1];

function clearBets() {
  if (state.phase !== 'bet') return;
  const refund = sum(state.bets);
  if (!refund) return sfx.uiClick();
  clearTableEffect();
  state.balance += refund;
  state.bets = {}; state.undo = [];
  sfx.sweep(); render();
}
function rebet() {
  if (state.phase !== 'bet') return;
  const cost = sum(state.lastBets);
  if (!cost) return msg('No previous bets.', true);
  if (cost > state.balance) return msg('Not enough credits to rebet.', true);
  const step = Object.entries(state.lastBets);
  for (const [k, v] of step) state.bets[k] = (state.bets[k] || 0) + v;
  state.balance -= cost; state.undo.push(step);
  if (state.phase === 'bet') clearMarks();
  sfx.chip(); msg(''); render();
}
function refill() {
  if (state.phase !== 'bet') return;
  state.balance += START_BALANCE; countUp = true;
  sfx.sweep(); msg(`${formatCredits(START_BALANCE)} demo credits added.`); render();
}

$('clear').onclick = clearBets;
$('repeat').onclick = rebet;
$('undo').onclick = undo;
$('refill').onclick = refill;
$('spin').onclick = trySpin;

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.altKey || (e.ctrlKey && e.code !== 'KeyZ')) return;
  if (e.target.closest('button, input, select, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); trySpin(); }
  else if (e.code === 'KeyM') toggleSound();
  else if (e.code === 'KeyZ' || e.code === 'Backspace') { e.preventDefault(); undo(); }
  else if (e.code === 'KeyR') rebet();
  else if (e.code === 'KeyC') clearBets();
  else if (/^Digit[1-4]$/.test(e.code)) selectChip(CHIPS[+e.code.at(-1) - 1][0]);
});

// Audio can only start inside a user gesture. iOS counts touchend/click but not pointerdown,
// so listen to all of them; sfx.start() is cheap after the first call.
['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach((t) => window.addEventListener(t, () => sfx.start(), { capture: true, passive: true }));

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
  if (!Object.keys(state.bets).length) return msg('Choose a spot to place your bet.', true);
  msg('No more bets. Good luck!');
  clearMarks();
  $('banner').classList.add('hidden');
  startSpin(); render();
  closeSheet();
}

const touch = matchMedia('(hover: none)').matches;
const HINT = touch ? 'Choose a chip and tap the table.' : 'Choose a chip and place your bets.';
function msg(text, warn = false) {
  $('msg').textContent = text || HINT;
  $('msg').classList.toggle('warn', warn);
}
msg('');

function render() {
  const staked = sum(state.bets);
  if (!countUp) $('balance').textContent = formatCredits(state.balance);
  $('staked').textContent = formatCredits(staked);
  $('sheet-staked').textContent = formatCredits(staked);
  document.querySelectorAll('.chip').forEach((c) => {
    c.classList.toggle('sel', +c.dataset.v === state.chip);
    c.classList.toggle('poor', +c.dataset.v > state.balance);
    c.disabled = state.phase !== 'bet';
    c.setAttribute('aria-pressed', String(+c.dataset.v === state.chip));
  });
  for (const { el } of cells) {
    let mark = el.querySelector('.chipmark');
    const amt = state.bets[el.dataset.bet];
    if (amt) {
      if (!mark) { mark = document.createElement('span'); mark.className = 'chipmark'; el.appendChild(mark); }
      mark.textContent = amt; mark.style.background = chipColor(amt);
      el.setAttribute('aria-label', `${el.dataset.aria}, your bet ${formatCredits(amt)}`);
    } else {
      mark?.remove();
      el.setAttribute('aria-label', el.dataset.aria);
    }
  }
  const locked = state.phase !== 'bet';
  $('spin').innerHTML = state.phase === 'spin' ? 'SPINNING…' : state.phase === 'result' ? 'ROUND COMPLETE' : staked ? 'SPIN THE WHEEL <span aria-hidden="true">↗</span>' : 'PLACE A BET <span aria-hidden="true">↗</span>';
  document.body.classList.toggle('is-spinning', locked);
  for (const { el } of cells) {
    el.disabled = locked; el.setAttribute('aria-disabled', String(locked));
    el.setAttribute('aria-pressed', String(Boolean(state.bets[el.dataset.bet])));
  }
  $('full-table-open').disabled = locked;
  board.classList.toggle('locked', locked);
  $('spin').disabled = locked || !staked;
  $('clear').disabled = locked || !staked;
  $('undo').disabled = locked || !state.undo.length;
  $('repeat').disabled = locked || !sum(state.lastBets);
  const broke = !locked && state.balance + staked < MIN_CHIP;
  $('refill').hidden = !broke;
  $('repeat').hidden = broke;
  $('game-shell').dataset.phase = state.phase;
  $('history-empty').hidden = state.history.length > 0;
  $('history').innerHTML = state.history.map((n) => `<div class="h ${colorOf(n)}" aria-label="${n} ${colorName(n)}">${n}</div>`).join('');
  save();
}
render();

// ---------------- layout / camera ----------------
// The Three.js viewport lives beside the host; betting never moves the stage.
const look = new THREE.Vector3(0, 0, 0.2);
let distScale = 1, focus = 0, balShown = state.balance;
const fogNear = scene.fog.near, fogFar = scene.fog.far;
function resize() {
  const { width, height } = $('wheel-viewport').getBoundingClientRect();
  const w = Math.max(1, width), h = Math.max(1, height);
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.clearViewOffset();
  const span = 2 * Math.hypot(7.4, 9.2) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  distScale = Math.max(.84, 9.8 / (span * camera.aspect), 6.6 / span);
  scene.fog.near = fogNear * distScale; scene.fog.far = fogFar * distScale;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe($('wheel-viewport'));
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

  // winnings count up instead of jumping
  if (countUp) {
    balShown = Math.min(state.balance, balShown + Math.max(1, (state.balance - balShown) * dt * 4));
    if (balShown >= state.balance) countUp = false;
    $('balance').textContent = formatCredits(Math.floor(balShown));
    $('balbox').classList.toggle('gain', countUp);
  } else balShown = state.balance;

  // camera: slow sway, dolly in while spinning, subtle movement on wins
  const sway = reduceMotion.matches ? 0 : Math.sin(time * 0.17) * 0.18;
  const d = distScale * lerp(1, 0.97, smooth(focus));
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
