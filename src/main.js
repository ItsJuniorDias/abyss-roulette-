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
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const world = createWorld($('gl'));
const { renderer, scene, camera, rotor, ball, ballGlow } = world;

// optional generated backdrop (WebP first, then the raw PNG from gen:assets)
(function loadBackdrop(exts) {
  if (!exts.length) return;
  const img = new Image();
  img.onload = () => { $('bg').style.backgroundImage = `url(${img.src})`; $('bg').classList.add('img'); };
  img.onerror = () => loadBackdrop(exts.slice(1));
  img.src = `${import.meta.env.BASE_URL}assets/background.${exts[0]}`;
})(['webp', 'png']);

// ---------------- game state ----------------
const START_BALANCE = 1000;
const SAVE_KEY = 'abyss-roulette:save';
const CHIPS = [[1, '#2b6b60'], [5, '#b3191c'], [25, '#1b1514'], [100, '#a8741e']];
const MIN_CHIP = CHIPS[0][0];

const saved = (() => {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
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
let tucked = false; // phones: betting panel slid away while the ball is live
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

  showResult(n, won, staked, winners);
  // phones: keep the wheel full-screen while the result banner plays, then bring the table back
  if (tucked) setTimeout(() => { if (state.phase === 'spin') return; $('banner').classList.add('hidden'); setTucked(false); }, 2600);
  setTimeout(() => { state.phase = 'bet'; msg(''); render(); }, 1600);
  render();
}

// ---------------- result FX ----------------
const WIN_SFX = ['KRA-THOOM!', 'SKRAKK!', 'BWOOOM!', 'KZZAKT!', 'DOOOM!'];
const LOSE_SFX = ['thunk.', '...krrk', 'tok.'];
let bannerTimer;

function showResult(n, won, staked, winners) {
  const banner = $('banner');
  $('sfx').textContent = won > 0 ? pick(WIN_SFX) : pick(LOSE_SFX);
  $('sfx').classList.toggle('lose', won === 0);
  $('bnum').textContent = n;
  $('bnum').className = 'num ' + colorOf(n);
  $('bsub').textContent = won > 0 ? `+${won}` : `THE HOUSE THANKS YOU · −${staked}`;
  banner.classList.remove('hidden', 'show'); void banner.offsetWidth; banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => banner.classList.add('hidden'), 3200);

  clearMarks();
  document.querySelectorAll(`.cell[data-bet="n${n}"]`).forEach((c) => c.classList.add('hit'));
  winners.forEach((k) => document.querySelector(`.cell[data-bet="${k}"]`)?.classList.add('won'));

  $('sr').textContent = `${n} ${colorOf(n)}. ` + (won > 0 ? `You win ${won}.` : `You lose ${staked}.`) + ` Balance ${state.balance}.`;

  const big = won > 0 && won >= staked * 10;
  sfx.result(won > 0 ? (big ? 'bigwin' : 'win') : 'lose');
  const motion = reduceMotion.matches ? 0 : 1;
  if (won > 0) {
    shake = (0.35 + Math.min(won / 400, 0.5)) * motion;
    world.fireBurst(ball.getWorldPosition(new THREE.Vector3()), big ? 1.6 : 1);
    sfx.ember(big ? 1.3 : 1);
    flash(0.55);
  } else {
    shake = 0.08 * motion;
    flash(0.15);
  }
}

function flash(v) {
  const calm = reduceMotion.matches;
  $('flash').animate([{ opacity: calm ? v * 0.35 : v }, { opacity: 0 }], { duration: calm ? 900 : 600, easing: calm ? 'ease-out' : 'steps(6)' });
}

const clearMarks = () => document.querySelectorAll('.cell.hit, .cell.won').forEach((c) => c.classList.remove('hit', 'won'));

// ---------------- betting board ----------------
// Each cell knows its spot in the wide (desktop) layout and the tall (phone) layout.
const board = $('board');
const cells = [];
function cell(key, text, cls, wide, tall, aria) {
  const el = document.createElement('div');
  el.className = `cell ${cls}`;
  el.dataset.bet = key;
  el.textContent = text;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.dataset.aria = `${aria}, pays ${BETS[key].pay} to 1`;
  board.appendChild(el);
  cells.push({ el, wide, tall });
}
// [col, row, colSpan, rowSpan]
cell('n0', '0', 'green', [1, 1, 1, 3], [3, 1, 3, 1], 'Zero');
for (let n = 1; n <= 36; n++) {
  const c = Math.ceil(n / 3) - 1, r = (n - 1) % 3; // c: 0..11 along the table, r: 0 = bottom row (1, 4, 7…)
  cell('n' + n, String(n), colorOf(n), [c + 2, 3 - r, 1, 1], [r + 3, c + 2, 1, 1], `${n} ${colorOf(n)}`);
}
for (let k = 1; k <= 3; k++) cell('c' + k, '2:1', 'out', [14, 4 - k, 1, 1], [k + 2, 14, 1, 1], `Column ${k}`);
for (let k = 1; k <= 3; k++) cell('d' + k, BETS['d' + k].label, 'out dz', [2 + (k - 1) * 4, 4, 4, 1], [2, 2 + (k - 1) * 4, 1, 4], `${BETS['d' + k].label}`);
['low', 'even', 'red', 'black', 'odd', 'high'].forEach((k, i) =>
  cell(k, BETS[k].label, `out ${k === 'red' || k === 'black' ? k : ''}`, [2 + i * 2, 5, 2, 1], [1, 2 + i * 2, 1, 2], BETS[k].label));

const tallQuery = matchMedia('(max-width: 600px) and (orientation: portrait)');
function layoutBoard() {
  const tall = tallQuery.matches;
  board.classList.toggle('tall', tall);
  for (const c of cells) {
    const [col, row, cs, rs] = tall ? c.tall : c.wide;
    c.el.style.gridColumn = `${col} / span ${cs}`;
    c.el.style.gridRow = `${row} / span ${rs}`;
  }
}
tallQuery.addEventListener('change', () => { layoutBoard(); resize(); });
layoutBoard();

function placeBet(key) {
  if (state.phase === 'spin') return msg('No more bets!', true);
  if (state.balance < state.chip) return msg(state.balance < MIN_CHIP ? 'Out of credits. Refill to keep playing.' : 'Not enough balance for that chip.', true);
  state.balance -= state.chip;
  state.bets[key] = (state.bets[key] || 0) + state.chip;
  state.undo.push([[key, state.chip]]);
  if (state.phase === 'bet') clearMarks();
  sfx.chip(); msg(''); render();
}

function removeBet(key) {
  if (state.phase === 'spin') return;
  const amt = state.bets[key]; if (!amt) return;
  state.balance += amt; delete state.bets[key];
  sfx.uiClick(); render();
}

function undo() {
  if (state.phase === 'spin') return;
  const step = state.undo.pop();
  if (!step) return msg('Nothing to undo.', true);
  for (const [k, amt] of step) {
    const take = Math.min(state.bets[k] || 0, amt); // the cell may have been cleared since
    state.bets[k] -= take; state.balance += take;
    if (!state.bets[k]) delete state.bets[k];
  }
  sfx.uiClick(); msg(''); render();
}

board.addEventListener('click', (e) => {
  const el = e.target.closest('.cell'); if (el) placeBet(el.dataset.bet);
});
board.addEventListener('contextmenu', (e) => {
  const el = e.target.closest('.cell'); if (!el) return;
  e.preventDefault(); removeBet(el.dataset.bet);
});
board.addEventListener('keydown', (e) => {
  const el = e.target.closest('.cell'); if (!el) return;
  if (e.key === 'Enter') { e.preventDefault(); placeBet(el.dataset.bet); }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); removeBet(el.dataset.bet); }
});

// chips
CHIPS.forEach(([v, color], i) => {
  const b = document.createElement('button');
  b.className = 'chip'; b.textContent = v; b.style.background = color; b.dataset.v = v;
  b.setAttribute('aria-label', `Chip ${v}`); b.title = `Chip ${v} (${i + 1})`;
  b.onclick = () => selectChip(v);
  $('chips').appendChild(b);
});
function selectChip(v) { state.chip = v; sfx.uiClick(); render(); }
const chipColor = (amt) => [...CHIPS].reverse().find(([v]) => amt >= v)[1];

function clearBets() {
  if (state.phase === 'spin') return;
  const refund = sum(state.bets);
  if (!refund) return sfx.uiClick();
  state.balance += refund;
  state.bets = {}; state.undo = [];
  sfx.sweep(); render();
}
function rebet() {
  if (state.phase === 'spin') return;
  const cost = sum(state.lastBets);
  if (!cost) return msg('No previous bet.', true);
  if (cost > state.balance) return msg('Not enough balance to rebet.', true);
  const step = Object.entries(state.lastBets);
  for (const [k, v] of step) state.bets[k] = (state.bets[k] || 0) + v;
  state.balance -= cost; state.undo.push(step);
  if (state.phase === 'bet') clearMarks();
  sfx.chip(); msg(''); render();
}
function refill() {
  if (state.phase === 'spin') return;
  state.balance += START_BALANCE; countUp = true;
  sfx.sweep(); msg(`The abyss lends you ${START_BALANCE} more.`); render();
}

$('clear').onclick = clearBets;
$('repeat').onclick = rebet;
$('undo').onclick = undo;
$('refill').onclick = refill;
$('spin').onclick = trySpin;

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.altKey || (e.ctrlKey && e.code !== 'KeyZ')) return;
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
  if (!Object.keys(state.bets).length) return msg('Place a bet first.', true);
  msg('No more bets…');
  clearMarks();
  $('banner').classList.add('hidden');
  startSpin(); render();
  setTucked(true);
}

const touch = matchMedia('(hover: none)').matches;
const HINT = touch ? 'Pick a chip and tap the table · UNDO takes back a chip' : 'Pick a chip and click the table · right-click removes · Z undoes';
function msg(text, warn = false) {
  $('msg').textContent = text || HINT;
  $('msg').classList.toggle('warn', warn);
}
msg('');

function render() {
  const staked = sum(state.bets);
  if (!countUp) $('balance').textContent = state.balance;
  $('staked').textContent = staked;
  document.querySelectorAll('.chip').forEach((c) => {
    c.classList.toggle('sel', +c.dataset.v === state.chip);
    c.classList.toggle('poor', +c.dataset.v > state.balance);
    c.setAttribute('aria-pressed', String(+c.dataset.v === state.chip));
  });
  for (const { el } of cells) {
    let mark = el.querySelector('.chipmark');
    const amt = state.bets[el.dataset.bet];
    if (amt) {
      if (!mark) { mark = document.createElement('span'); mark.className = 'chipmark'; el.appendChild(mark); }
      mark.textContent = amt; mark.style.background = chipColor(amt);
      el.setAttribute('aria-label', `${el.dataset.aria}, your bet ${amt}`);
    } else {
      mark?.remove();
      el.setAttribute('aria-label', el.dataset.aria);
    }
  }
  const locked = state.phase === 'spin';
  board.classList.toggle('locked', locked);
  $('spin').disabled = state.phase !== 'bet';
  ['clear', 'repeat', 'undo'].forEach((id) => { $(id).disabled = locked; });
  const broke = !locked && state.balance + staked < MIN_CHIP;
  $('refill').hidden = !broke;
  $('repeat').hidden = broke;
  $('history').innerHTML = state.history.map((n) => `<div class="h ${colorOf(n)}">${n}</div>`).join('');
  save();
}
render();

// ---------------- layout / camera ----------------
// On phones the table slides away while the ball is live, so the wheel gets the whole screen.
// panelH eases toward the panel's visible height every frame, and the camera follows it.
const look = new THREE.Vector3(0, 0, 0.2);
let distScale = 1, focus = 0, panelH = 0, panelTarget = 0, balShown = state.balance;
const fogNear = scene.fog.near, fogFar = scene.fog.far;

function setTucked(v) {
  tucked = v && tallQuery.matches;
  $('panel').classList.toggle('tucked', tucked);
  resize();
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  panelTarget = tucked ? 0 : $('panel').offsetHeight;
  if (!panelH) panelH = panelTarget;
  applyLayout();
}
window.addEventListener('resize', resize);

function applyLayout() {
  const w = window.innerWidth, h = window.innerHeight;
  const topH = $('top').offsetHeight;
  // center the wheel in the free space between the header and the betting panel
  camera.setViewOffset(w, h, 0, (panelH - topH) / 2, w, h);
  // At distScale 1 the wheel is about 1.15h wide and 0.6h tall on screen: back off until it fits.
  const availH = Math.max(h - panelH - topH, 120);
  distScale = Math.min(Math.max(1, (1.15 * h) / (0.96 * w), (0.6 * h) / (0.96 * availH)), 4);
  scene.fog.near = fogNear * distScale; scene.fog.far = fogFar * distScale;
  camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--stage-y', `${(topH + h - panelH) / 2}px`);
}
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

  // layout follows the panel sliding in and out
  if (Math.abs(panelTarget - panelH) > 0.5) {
    panelH += (panelTarget - panelH) * Math.min(1, dt * 7);
    applyLayout();
  }

  // winnings count up instead of jumping
  if (countUp) {
    balShown = Math.min(state.balance, balShown + Math.max(1, (state.balance - balShown) * dt * 4));
    if (balShown >= state.balance) countUp = false;
    $('balance').textContent = Math.floor(balShown);
    $('balbox').classList.toggle('gain', countUp);
  } else balShown = state.balance;

  // camera: slow sway, dolly in while spinning, ink-panel shake on wins
  const sway = reduceMotion.matches ? 0 : Math.sin(time * 0.17) * 0.18;
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
