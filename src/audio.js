// Game audio.
// Samples come from public/audio (prepared by scripts/prepare-audio.mjs and listed in
// manifest.json). Every sound has a synthesized fallback, so the game still works with
// no audio files or before they finish loading.
//
// Mix: streaming lounge music / decoded short SFX -> compressor -> master (mute).
// Music streams to avoid decoding a two-minute stereo track into mobile memory.

const BASE = `${import.meta.env.BASE_URL}audio/`;
const MIX = { music: 0.38, sfx: 0.8 };
const MUTE_KEY = 'aurum-club:muted';
const music = document.getElementById('lounge-music');

let ac = null;
let master, comp, noiseBuf;
const bus = {};
const buffers = {};
let manifest = {};
let started = false;
let muted = readMuted();
let musicRestore = 0;

// iOS: play through the silent switch, like a music app, instead of as a ringer-level sound.
try { if ('audioSession' in navigator) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }

function readMuted() {
  try { return (localStorage.getItem(MUTE_KEY) ?? localStorage.getItem('abyss-roulette:muted')) === '1'; } catch { return false; }
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
    ac.createMediaElementSource(music).connect(bus.music);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // pause everything while the tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        music.pause();
        ac.suspend().catch(() => {});
      } else if (started) {
        ac.resume().catch(() => {});
        resumeMusic();
      }
    });
  }
  // iOS can also leave the context 'interrupted' (after a call, Siri, backgrounding)
  if (ac.state !== 'running' && !document.hidden) ac.resume().catch(() => {});
  return ac;
}

// ---------- loading ----------
async function loadManifest() {
  try {
    const r = await fetch(`${BASE}manifest.json`, { cache: 'no-cache' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return false;
    manifest = await r.json();
    return true;
  } catch { return false; }
}

async function loadBuffer(slot) {
  try {
    const asset = manifest[slot];
    const r = await fetch(`${BASE}${asset.file}?v=${asset.sha256?.slice(0, 12) || '1'}`);
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
  s.onended = () => { s.disconnect(); g.disconnect(); };
  s.start(ac.currentTime + delay);
  return { src: s, gain: g };
}

function loop(slot, { vol = 1, to = 'sfx', fadeIn = 2 } = {}) {
  const b = buffers[slot];
  if (!b) return null;
  const [start, end] = manifest[slot].loop || [0, b.duration];
  const s = ac.createBufferSource();
  s.buffer = b; s.loop = true; s.loopStart = start; s.loopEnd = end;
  const g = ac.createGain();
  g.gain.value = 0;
  ramp(g.gain, vol, fadeIn);
  s.connect(g).connect(bus[to]);
  s.onended = () => { s.disconnect(); g.disconnect(); };
  s.start(ac.currentTime, start);
  return { src: s, gain: g };
}

// ---------- short musical fallback ----------
function pianoNote(midi, when, duration = 2.4, volume = .11, destination = 'music') {
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  [1, 2, 3].forEach((harmonic, i) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = frequency * harmonic;
    g.gain.setValueAtTime(.0001, when);
    g.gain.exponentialRampToValueAtTime(volume / (harmonic * harmonic), when + .018);
    g.gain.exponentialRampToValueAtTime(.0001, when + duration / (1 + i * .25));
    o.connect(g).connect(bus[destination]); o.start(when); o.stop(when + duration);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  });
}
function resumeMusic() {
  if (!started || muted || document.hidden || !music.paused) return;
  // Called synchronously inside gestures too, so a blocked mobile play can retry.
  music.play().catch(() => {});
}

// iOS also needs a sound started inside the gesture before the context makes noise.
function unlockOutput() {
  const s = ac.createBufferSource();
  s.buffer = ac.createBuffer(1, 1, ac.sampleRate);
  s.connect(ac.destination);
  s.start();
}

// The first gesture unlocks both Web Audio and the streaming media element.
export function start() {
  audio();
  if (started) {
    resumeMusic();
    return;
  }
  started = true;
  unlockOutput();
  resumeMusic();
  boot();
}

async function boot() {
  if (!(await loadManifest())) return;
  const slots = ['sfx_chip_place', 'sfx_chip_stack_clear', 'sfx_ui_click', 'sfx_wheel_spin_start',
    'sfx_ball_roll_loop', 'sfx_ball_deflector', 'sfx_ball_hit_a', 'sfx_ball_hit_b',
    'sfx_ball_settle', 'sfx_win_fanfare'];
  await Promise.all(slots.filter(slot => manifest[slot]).map(loadBuffer));
}

// ---------- mute ----------
export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage blocked */ }
  if (ac) ramp(master.gain, muted ? 0 : 1, 0.15);
  if (muted) music.pause();
  else resumeMusic();
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
  const g = ac.createGain(); env(g, t, 0.15, 0.12, 1.3);
  s.connect(f).connect(g).connect(bus.sfx); s.start(t); s.stop(t + 1.4);
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
  ramp(bus.music.gain, MIX.music * 0.65, 0.8);
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
  clearTimeout(musicRestore);
  const victory = kind !== 'lose';
  if (victory) ramp(bus.music.gain, MIX.music * 0.45, 0.2);
  musicRestore = setTimeout(() => ramp(bus.music.gain, MIX.music, 1.8), victory ? 4300 : 1000);

  if (kind === 'lose') { pianoNote(55, ac.currentTime, .45, .07, 'sfx'); return; }
  if (!play('sfx_win_fanfare', { vol: kind === 'bigwin' ? 0.85 : 0.55 })) {
    const notes = kind === 'bigwin' ? [72, 76, 79, 83, 86] : [72, 76, 79];
    notes.forEach((note, i) => pianoNote(note, ac.currentTime + i * .11, 1.6, .13, 'sfx'));
  }
  sweep(1.1);
}
