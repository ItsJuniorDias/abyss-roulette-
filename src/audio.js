// Game audio.
// Samples come from public/audio (prepared by scripts/prepare-audio.mjs and listed in
// manifest.json). Every sound has a synthesized fallback, so the game still works with
// no audio files or before they finish loading.
//
// Mix: three buses (music / ambience / sfx) -> soft compressor -> master (mute).
// Music streams through <audio> elements; everything else is decoded into AudioBuffers.

const BASE = `${import.meta.env.BASE_URL}audio/`;
const MIX = { music: 0.42, amb: 0.55, sfx: 0.95 };
const MUTE_KEY = 'abyss-roulette:muted';

let ac = null;
let master, comp, noiseBuf;
const bus = {};
const buffers = {};
let manifest = {};
let started = false;
let muted = readMuted();
let music = null;
let tension = null;
let musicRestore = 0;

// iOS: play through the silent switch, like a music app, instead of as a ringer-level sound.
try { if ('audioSession' in navigator) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }

function readMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function audio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ac.destination);
    comp = ac.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(master);
    for (const k of Object.keys(MIX)) {
      bus[k] = ac.createGain();
      bus[k].gain.value = MIX[k];
      bus[k].connect(comp);
    }
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // pause everything while the tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ac.suspend();
      else ac.resume();
      if (music) music.el.forEach((el) => { if (document.hidden) el.pause(); else if (el.dataset.active) el.play().catch(() => {}); });
    });
  }
  // iOS can also leave the context 'interrupted' (after a call, Siri, backgrounding)
  if (ac.state !== 'running' && !document.hidden) ac.resume().catch(() => {});
  return ac;
}

// ---------- loading ----------
async function loadManifest() {
  try {
    const r = await fetch(`${BASE}manifest.json`);
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return false;
    manifest = await r.json();
    return true;
  } catch { return false; }
}

async function loadBuffer(slot) {
  try {
    const r = await fetch(BASE + manifest[slot].file);
    if (r.ok) buffers[slot] = await ac.decodeAudioData(await r.arrayBuffer());
  } catch { /* keep the synth fallback */ }
}

const has = (slot) => !!buffers[slot];
const ramp = (param, value, time = 0.3) => param.setTargetAtTime(value, ac.currentTime, time / 3);

function play(slot, { vol = 1, rate = 1, to = 'sfx', delay = 0 } = {}) {
  const b = buffers[slot];
  if (!b) return null;
  const s = ac.createBufferSource();
  s.buffer = b;
  s.playbackRate.value = rate;
  const g = ac.createGain();
  g.gain.value = vol;
  s.connect(g).connect(bus[to]);
  s.start(ac.currentTime + delay);
  return { src: s, gain: g };
}

function loop(slot, { vol = 1, to = 'amb', fadeIn = 2 } = {}) {
  const b = buffers[slot];
  if (!b) return null;
  const [start, end] = manifest[slot].loop || [0, b.duration];
  const s = ac.createBufferSource();
  s.buffer = b; s.loop = true; s.loopStart = start; s.loopEnd = end;
  const g = ac.createGain();
  g.gain.value = 0;
  ramp(g.gain, vol, fadeIn);
  s.connect(g).connect(bus[to]);
  s.start(ac.currentTime, start);
  return { src: s, gain: g };
}

// ---------- music playlist (streamed, crossfaded) ----------
// Safari only lets a media element play from script once it has played inside a user
// gesture. primeMusic() runs inside the first gesture and plays a silent clip on both
// players, so startMusic() can start the real tracks later, after the manifest loads.
function silentClip() {
  const n = 441, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

let players = null;
function primeMusic() {
  const silent = silentClip();
  players = [new Audio(), new Audio()].map((e) => {
    e.preload = 'auto';
    e.playsInline = true;
    e.src = silent;
    e.play().then(() => { if (!e.dataset.active) e.pause(); }).catch(() => {});
    const g = ac.createGain();
    g.gain.value = 0;
    ac.createMediaElementSource(e).connect(g).connect(bus.music);
    return { e, g };
  });
}

// iOS also needs a sound started inside the gesture before the context makes noise.
function unlockOutput() {
  const s = ac.createBufferSource();
  s.buffer = ac.createBuffer(1, 1, ac.sampleRate);
  s.connect(ac.destination);
  s.start();
}

function startMusic() {
  const tracks = Object.entries(manifest).filter(([, v]) => v.kind === 'music').map(([, v]) => BASE + v.file);
  if (!tracks.length || !players) return;
  const XF = 4;
  const el = players.map((p) => p.e);
  const gain = players.map((p) => p.g);
  let next = 0, cur = 0;
  const start = (k) => {
    const e = el[k];
    e.src = tracks[next++ % tracks.length];
    e.currentTime = 0;
    e.dataset.active = '1';
    e.dataset.handed = '';
    e.play().catch(() => {});
    ramp(gain[k].gain, 1, XF);
    cur = k;
  };
  el.forEach((e, k) => {
    e.addEventListener('timeupdate', () => {
      if (k !== cur || e.dataset.handed || !e.duration) return;
      if (e.duration - e.currentTime < XF) {
        e.dataset.handed = '1';
        ramp(gain[k].gain, 0, XF);
        setTimeout(() => { e.pause(); e.dataset.active = ''; }, XF * 1000 + 200);
        start(1 - k);
      }
    });
  });
  start(0);
  music = { el, gain };
}

// Call from every user gesture. The first one unlocks audio, then loads the manifest,
// starts the music right away and the ambience as soon as each loop is decoded.
export function start() {
  audio();
  if (started) {
    // if a browser still blocked a play() that ran after an await, retry on this gesture
    music?.el.forEach((e) => { if (e.dataset.active && e.paused && !document.hidden) e.play().catch(() => {}); });
    return;
  }
  started = true;
  unlockOutput();
  primeMusic();
  boot();
}

async function boot() {
  if (!(await loadManifest())) return;
  startMusic();
  const slots = Object.keys(manifest).filter((k) => manifest[k].kind !== 'music');
  const amb = [['amb_crypt_loop', 0.55], ['amb_candle_fire_loop', 0.35]];
  await Promise.all([
    ...amb.map(([slot, vol]) => manifest[slot] && loadBuffer(slot).then(() => loop(slot, { vol, fadeIn: 4 }))),
    ...slots.filter((k) => !amb.some(([a]) => a === k)).map(loadBuffer),
  ]);
}

// ---------- mute ----------
export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage blocked */ }
  if (ac) ramp(master.gain, muted ? 0 : 1, 0.15);
  return muted;
}

// ---------- synth fallbacks ----------
function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function synthClick(vol = 0.25, freq = 3000) {
  const t = ac.currentTime;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq * (0.8 + Math.random() * 0.5); f.Q.value = 3;
  const g = ac.createGain(); env(g, t, 0.002, vol, 0.05);
  s.connect(f).connect(g).connect(bus.sfx);
  s.start(t, Math.random()); s.stop(t + 0.06);
}

function synthWhoosh() {
  const t = ac.currentTime;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.35); f.frequency.exponentialRampToValueAtTime(200, t + 1.2);
  const g = ac.createGain(); env(g, t, 0.15, 0.5, 1.3);
  s.connect(f).connect(g).connect(bus.sfx); s.start(t); s.stop(t + 1.4);
}

function synthGong(win) {
  const t = ac.currentTime;
  const base = win ? 98 : 73;
  const parts = win ? [1, 1.5, 2.01, 2.76, 4.1] : [1, 2.4];
  parts.forEach((m, i) => {
    const o = ac.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = base * m;
    const g = ac.createGain(); env(g, t, 0.01, (win ? 0.28 : 0.2) / (i + 1), win ? 3.5 : 1.4);
    o.connect(g).connect(bus.sfx); o.start(t); o.stop(t + 3.6);
  });
}

const jitter = (amt = 0.06) => 1 + (Math.random() * 2 - 1) * amt;

// ---------- game sounds ----------
export function uiClick() {
  audio();
  if (!play('sfx_ui_click', { vol: 0.8, rate: jitter(0.04) })) synthClick(0.3, 2000);
}

export function chip() {
  audio();
  if (!play('sfx_chip_place', { vol: 0.85, rate: jitter(0.08) })) { synthClick(0.35, 4200); setTimeout(() => synthClick(0.2, 5200), 40); }
}

export function sweep(delay = 0) {
  audio();
  if (!play('sfx_chip_stack_clear', { vol: 0.8, rate: jitter(0.05), delay })) synthClick(0.3, 3500);
}

export function spinStart() {
  audio();
  if (!play('sfx_wheel_spin_start', { vol: 0.75 })) synthWhoosh();
  // duck the music a little while the ball is live (and cancel a pending restore from the last round)
  clearTimeout(musicRestore);
  if (music) ramp(bus.music.gain, MIX.music * 0.65, 0.8);
  if (has('music_spin_tension')) tension = play('music_spin_tension', { vol: 0.7, to: 'music' });
}

// Ball rolling loop: call set(intensity 0..1, speed rad/s) every frame, stop() at the end.
export function rollLoop() {
  audio();
  const sample = loop('sfx_ball_roll_loop', { vol: 0, to: 'sfx', fadeIn: 0.05 });
  if (sample) {
    return {
      set(v, speed) {
        ramp(sample.gain.gain, v, 0.12);
        sample.src.playbackRate.setTargetAtTime(0.75 + Math.min(speed / 14, 1) * 0.5, ac.currentTime, 0.05);
      },
      stop() { ramp(sample.gain.gain, 0, 0.3); sample.src.stop(ac.currentTime + 0.6); },
    };
  }
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
  const g = ac.createGain(); g.gain.value = 0;
  s.connect(f).connect(g).connect(bus.sfx); s.start();
  return {
    set(v) { ramp(g.gain, v * 0.25, 0.15); f.frequency.setTargetAtTime(400 + v * 4000, ac.currentTime, 0.05); },
    stop() { ramp(g.gain, 0, 0.3); s.stop(ac.currentTime + 0.5); },
  };
}

export function deflector(vol = 1) {
  if (!play('sfx_ball_deflector', { vol: 0.9 * vol, rate: jitter(0.05) })) synthClick(0.4 * vol, 2600);
}

export function ballHit(vol = 1) {
  const slot = Math.random() < 0.5 && has('sfx_ball_hit_b') ? 'sfx_ball_hit_b' : 'sfx_ball_hit_a';
  if (!play(slot, { vol: vol, rate: jitter(0.1) })) synthClick(0.35 * vol, 3200);
}

// tiny tick as the ball skims over the pocket frets
export function fret(vol = 0.2) {
  if (!play('sfx_ball_hit_b', { vol: vol * 0.6, rate: 1.5 * jitter(0.12) })) synthClick(vol, 3000);
}

export function settle() {
  play('sfx_ball_settle', { vol: 0.8 });
}

// kind: 'win' | 'bigwin' | 'lose'
export function result(kind) {
  audio();
  if (tension) { ramp(tension.gain.gain, 0, 0.6); tension.src.stop(ac.currentTime + 1.5); tension = null; }
  clearTimeout(musicRestore);
  if (music) musicRestore = setTimeout(() => ramp(bus.music.gain, MIX.music, 2.5), kind === 'bigwin' ? 3500 : 1500);

  if (kind === 'lose') {
    if (!play('sfx_lose_thud', { vol: 0.8 })) synthGong(false);
    return;
  }
  const bell = play('sfx_win_hit', { vol: kind === 'bigwin' ? 0.8 : 0.9 });
  if (!bell) synthGong(true);
  play('music_win_jingle', { vol: 0.5, delay: 0.07, to: 'music' });
  if (kind === 'bigwin') {
    if (music) ramp(bus.music.gain, MIX.music * 0.25, 0.2);
    play('sfx_bigwin_impact', { vol: 1 });
    play('music_bigwin_stinger', { vol: 0.75, to: 'music' });
  }
  sweep(kind === 'bigwin' ? 1.2 : 0.7);
}

export function ember(strength = 1) {
  play('sfx_ember_whoosh', { vol: 0.55 * strength, rate: jitter(0.08) });
}
