// Turns the raw Pixabay downloads in audio-src/ into game-ready files in public/audio/.
//
//   npm run audio:prepare
//
// For every job below it finds the source file by its Pixabay id (downloads are named
// "<author>-<slug>-<id>.mp3"), cuts the segment, trims leading silence, normalizes
// loudness, builds seamless loops and writes public/audio/manifest.json, which the
// game reads at startup. Jobs whose source file is missing are skipped, and the game
// falls back to its synthesized sound for that slot.
//
// Requires ffmpeg on PATH.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'audio-src');
const OUT = join(ROOT, 'public', 'audio');

// Loop files carry PAD seconds of wrapped audio on both sides of the loop region.
// That keeps the loop seamless even when a browser does not strip the MP3 encoder delay.
const PAD = 0.25;

const TARGET = { oneshot: -16, loop: -22, music: -18 }; // LUFS
const PEAK_TARGET = -3; // dBFS, for clips too short to measure loudness

// kind: oneshot | loop | music
// start/end: segment in seconds · fadeOut: seconds · xfade: loop crossfade seconds
// trim: remove leading silence (oneshots, default true) · gain: extra dB after normalizing
const JOBS = [
  // table & UI
  { slot: 'sfx_chip_place', id: 522523, kind: 'oneshot' },
  { slot: 'sfx_chip_stack_clear', id: 96121, kind: 'oneshot' },
  { slot: 'sfx_ui_click', id: 41289, kind: 'oneshot', gain: -3 },

  // roulette mechanics (roulette_casino_evian is a real casino recording)
  { slot: 'sfx_wheel_spin_start', id: 429832, kind: 'oneshot', end: 3.6, fadeOut: 1.2, gain: -2 },
  { slot: 'sfx_ball_roll_loop', id: 14446, kind: 'loop', start: 4.0, end: 8.5, xfade: 0.4, target: -18 },
  { slot: 'sfx_ball_deflector', id: 14446, kind: 'oneshot', start: 17.0, end: 17.65, fadeOut: 0.15, trim: false },
  { slot: 'sfx_ball_hit_a', id: 99750, kind: 'oneshot', start: 0.1, end: 0.55, fadeOut: 0.12 },
  { slot: 'sfx_ball_hit_b', id: 14446, kind: 'oneshot', start: 20.45, end: 20.64, fadeOut: 0.05, trim: false },
  { slot: 'sfx_ball_settle', id: 14446, kind: 'oneshot', start: 23.4, end: 24.2, fadeOut: 0.3, trim: false },

  // results
  { slot: 'sfx_win_hit', id: 352062, kind: 'oneshot' },
  { slot: 'sfx_bigwin_impact', id: 443132, kind: 'oneshot' },
  { slot: 'sfx_lose_thud', id: 291047, kind: 'oneshot', gain: -4 },
  { slot: 'sfx_ember_whoosh', id: 179125, kind: 'oneshot', gain: -3 },

  // ambience
  { slot: 'amb_crypt_loop', id: 6983, kind: 'loop', start: 10, end: 43, xfade: 3 },
  { slot: 'amb_candle_fire_loop', id: 123930, kind: 'loop', start: 5, end: 37, xfade: 2 },

  // music playlist (both without Content ID)
  // "Hidden Ritual" (465795) is deliberately left out: it is Content ID registered.
  { slot: 'music_main_a', id: 456038, kind: 'music' },
  { slot: 'music_main_b', id: 456523, kind: 'music' },

  // optional cues from the curated list: download them into audio-src/ and re-run
  { slot: 'music_spin_tension', id: 481586, kind: 'oneshot', end: 14, fadeOut: 2, trim: true, gain: -6 },
  { slot: 'music_win_jingle', id: 442713, kind: 'oneshot', end: 3.2, fadeOut: 0.9, gain: -6 },
  { slot: 'music_bigwin_stinger', id: 591739, kind: 'oneshot', end: 7, fadeOut: 2, gain: -3 },
];

function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8' });
  if (r.error) throw new Error('ffmpeg not found on PATH');
  if (r.status !== 0) throw new Error(r.stderr.split('\n').slice(-6).join('\n'));
  return r.stderr;
}

function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return parseFloat(r.stdout);
}

function measure(file) {
  const log = ff(['-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const json = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
  const peak = parseFloat(/max_volume: (-?[\d.]+) dB/.exec(ff(['-i', file, '-af', 'volumedetect', '-f', 'null', '-']))?.[1] ?? '0');
  return { lufs: parseFloat(json.input_i), truePeak: parseFloat(json.input_tp), peak };
}

const sources = (() => {
  try { return readdirSync(SRC); } catch { return []; }
})();
const findSource = (id) => sources.find((f) => f.includes(`-${id}.`));

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'abyss-audio-'));
const manifest = {};
let skipped = 0;

for (const job of JOBS) {
  const srcName = findSource(job.id);
  if (!srcName) { console.log(`- ${job.slot.padEnd(22)} skipped (no file with id ${job.id} in audio-src/)`); skipped++; continue; }
  const src = join(SRC, srcName);
  const seg = join(tmp, `${job.slot}-seg.wav`);
  const out = join(OUT, `${job.slot}.mp3`);

  // 1) cut the segment (plus a 3 ms fade-in when cutting mid-file, to avoid clicks)
  const cut = [];
  if (job.start != null) cut.push('-ss', String(job.start));
  if (job.end != null) cut.push('-to', String(job.end));
  const pre = [];
  if (job.kind === 'oneshot' && job.trim !== false) pre.push('silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.005');
  if (job.start != null) pre.push('afade=t=in:d=0.003');
  if (job.fadeOut) {
    const len = (job.end ?? probeDuration(src)) - (job.start ?? 0);
    pre.push(`afade=t=out:st=${Math.max(0, len - job.fadeOut).toFixed(3)}:d=${job.fadeOut}`);
  }
  ff([...cut, '-i', src, ...(pre.length ? ['-af', pre.join(',')] : []), '-ar', '44100', seg]);

  // 2) seamless loop: crossfade the tail into the head, then wrap PAD on both sides
  let body = seg;
  let loop = null;
  if (job.kind === 'loop') {
    const X = job.xfade ?? 1;
    const circ = join(tmp, `${job.slot}-circ.wav`);
    ff(['-i', seg, '-filter_complex',
      `[0:a]asplit=2[a][b];[a]atrim=start=${X},asetpts=PTS-STARTPTS[a1];[b]atrim=end=${X},asetpts=PTS-STARTPTS[b1];[a1][b1]acrossfade=d=${X}:c1=qsin:c2=qsin[c]`,
      '-map', '[c]', circ]);
    const Lc = probeDuration(circ);
    const padded = join(tmp, `${job.slot}-pad.wav`);
    ff(['-i', circ, '-filter_complex',
      `[0:a]asplit=3[x][y][z];[x]atrim=start=${(Lc - PAD).toFixed(4)},asetpts=PTS-STARTPTS[p];[z]atrim=end=${PAD},asetpts=PTS-STARTPTS[q];[p][y][q]concat=n=3:v=0:a=1[o]`,
      '-map', '[o]', padded]);
    body = padded;
    loop = [PAD, +(PAD + Lc).toFixed(4)];
  }

  // 3) normalize: loudness for normal clips, peak for very short ones
  const m = measure(body);
  const len = probeDuration(body);
  const target = job.target ?? TARGET[job.kind];
  let gain = (Number.isFinite(m.lufs) && len >= 0.6 ? target - m.lufs : PEAK_TARGET - m.peak) + (job.gain ?? 0);
  // one-shots get a limiter; loops and music must stay sample-exact, so their gain is capped to keep peaks under -1 dBTP
  if (job.kind !== 'oneshot') gain = Math.min(gain, -1 - m.truePeak);
  const filters = [`volume=${gain.toFixed(2)}dB`];
  if (job.kind === 'oneshot') filters.push('alimiter=limit=0.89:attack=1:release=40:level=false');

  // 4) encode
  const enc = job.kind === 'music' ? ['-b:a', '128k'] : job.kind === 'loop' ? ['-b:a', '160k'] : ['-q:a', '2'];
  ff(['-i', body, '-af', filters.join(','), '-c:a', 'libmp3lame', ...enc, out]);

  manifest[job.slot] = { file: `${job.slot}.mp3`, kind: job.kind, ...(loop ? { loop } : {}), source: srcName };
  console.log(`+ ${job.slot.padEnd(22)} ${len.toFixed(2).padStart(6)}s  gain ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB  ← ${srcName}`);
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
rmSync(tmp, { recursive: true, force: true });
console.log(`\n${Object.keys(manifest).length} prepared, ${skipped} skipped → public/audio/manifest.json`);
