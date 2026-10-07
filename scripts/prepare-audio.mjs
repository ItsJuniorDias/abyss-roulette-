// Turns the raw Pixabay downloads in audio-src/ into game-ready files in public/audio/.
//
//   npm run audio:prepare
//
// For every job below it finds the source file by its Pixabay id (downloads are named
// "<author>-<slug>-<id>.mp3"), cuts the segment, trims leading silence, normalizes
// loudness, builds seamless loops and writes public/audio/manifest.json, which the
// game reads at startup. A missing source aborts publication and preserves the existing runtime set.
// Short effects retain synthesized fallbacks if a browser cannot load them.
//
// Requires ffmpeg on PATH.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync, copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'audio-src');
const OUT = join(ROOT, 'public', 'audio');

// Loop files carry PAD seconds of wrapped audio on both sides of the loop region.
// That keeps the loop seamless even when a browser does not strip the MP3 encoder delay.
const PAD = 0.25;

const TARGET = { oneshot: -20, loop: -24, music: -18 }; // LUFS
const PEAK_TARGET = -7; // dBFS, for clips too short to measure loudness

// kind: oneshot | loop | music
// start/end: segment in seconds · fadeOut: seconds · xfade: loop crossfade seconds
// trim: remove leading silence (oneshots, default true) · gain: extra dB after normalizing
const SELECTION = JSON.parse(readFileSync(join(ROOT, 'design-system/audio-selection.json'), 'utf8'));
const provenance = new Map(SELECTION.assets.map(asset => [asset.id, asset]));
const JOBS = [
  { slot: 'music_lounge', id: 464517, kind: 'music', xfade: 2 },
  { slot: 'sfx_chip_place', id: 522521, kind: 'oneshot', gain: -2 },
  { slot: 'sfx_chip_stack_clear', id: 96121, kind: 'oneshot', gain: -3 },
  { slot: 'sfx_ui_click', id: 126517, kind: 'oneshot', gain: -6 },
  { slot: 'sfx_wheel_spin_start', id: 429832, kind: 'oneshot', end: 2.8, fadeOut: 1.0, gain: -5 },
  { slot: 'sfx_ball_roll_loop', id: 429831, kind: 'loop', start: .15, end: 2.15, xfade: .2 },
  { slot: 'sfx_ball_deflector', id: 429831, kind: 'oneshot', start: 2.75, end: 2.93, fadeOut: .04, trim: false },
  { slot: 'sfx_ball_hit_a', id: 429831, kind: 'oneshot', start: 3.02, end: 3.16, fadeOut: .035, trim: false },
  { slot: 'sfx_ball_hit_b', id: 429831, kind: 'oneshot', start: 4.0, end: 4.12, fadeOut: .03, trim: false },
  { slot: 'sfx_ball_settle', id: 429831, kind: 'oneshot', start: 5.6, end: 6.15, fadeOut: .12, trim: false, gain: -3 },
  { slot: 'sfx_win_fanfare', id: 144755, kind: 'oneshot', fadeOut: .35, target: -19 },
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
const findSource = (id) => sources.find(f => new RegExp(`-${id}(?: \\(\\d+\\))?\\.mp3$`, 'i').test(f));

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'aurum-audio-'));
const manifest = {};
let skipped = 0;

for (const job of JOBS) {
  const srcName = findSource(job.id);
  if (!srcName) { console.log(`- ${job.slot.padEnd(22)} skipped (no file with id ${job.id} in audio-src/)`); skipped++; continue; }
  const src = join(SRC, srcName);
  const seg = join(tmp, `${job.slot}-seg.wav`);
  const out = join(tmp, `${job.slot}.mp3`);

  // 1) cut the segment (plus a 3 ms fade-in when cutting mid-file, to avoid clicks)
  const cut = [];
  if (job.start != null) cut.push('-ss', String(job.start));
  if (job.end != null) cut.push('-to', String(job.end));
  const pre = [];
  if (job.kind === 'oneshot' && job.trim !== false) pre.push('silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.005');
  if (job.start != null) pre.push('afade=t=in:d=0.003');
  ff([...cut, '-i', src, ...(pre.length ? ['-af', pre.join(',')] : []), '-ar', '44100', seg]);

  // 2) seamless loop: crossfade the tail into the head, then wrap PAD on both sides
  let body = seg;
  let loop = null;
  if (job.kind === 'loop' || job.kind === 'music') {
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
    // Music streams through HTMLAudioElement, which loops the whole gapless MP3.
    body = job.kind === 'music' ? circ : padded;
    if (job.kind === 'loop') loop = [PAD, +(PAD + Lc).toFixed(4)];
  }

  // 3) normalize: loudness for normal clips, peak for very short ones
  const m = measure(body);
  const len = probeDuration(body);
  const target = job.target ?? TARGET[job.kind];
  let gain = (Number.isFinite(m.lufs) && len >= 0.6 ? target - m.lufs : PEAK_TARGET - m.peak) + (job.gain ?? 0);
  // one-shots get a limiter; loops and music must stay sample-exact, so their gain is capped to keep peaks under -1 dBTP
  if (job.kind !== 'oneshot') gain = Math.min(gain, -1 - m.truePeak);
  const filters = [`volume=${gain.toFixed(2)}dB`];
  if (job.fadeOut) filters.push(`afade=t=out:st=${Math.max(0, len - job.fadeOut).toFixed(3)}:d=${job.fadeOut}`);
  if (job.kind === 'oneshot') filters.push('alimiter=limit=0.89:attack=1:release=40:level=false');

  // 4) encode
  const enc = job.kind === 'music' ? ['-b:a', '128k'] : job.kind === 'loop' ? ['-b:a', '160k'] : ['-q:a', '2'];
  ff(['-i', body, '-af', filters.join(','), '-map_metadata', '-1', '-c:a', 'libmp3lame', ...enc, out]);

  const sha256 = createHash('sha256').update(readFileSync(out)).digest('hex');
  manifest[job.slot] = { file: `${job.slot}.mp3`, kind: job.kind, ...(loop ? { loop } : {}), duration: +probeDuration(out).toFixed(4), sha256, source: srcName, origin: provenance.get(job.id) };
  console.log(`+ ${job.slot.padEnd(22)} ${len.toFixed(2).padStart(6)}s  gain ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB  ← ${srcName}`);
}

if (skipped) {
  rmSync(tmp, { recursive: true, force: true });
  throw new Error('Incomplete audio set. Previous runtime files were preserved; add the missing downloads and rerun.');
}
const manifestPath = join(OUT, 'manifest.json');
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const currentFiles = new Set(Object.values(manifest).map(asset => asset.file));
for (const file of currentFiles) copyFileSync(join(tmp, file), join(OUT, file));
// Remove only obsolete generated files listed by the previous manifest.
for (const asset of Object.values(previous)) {
  if (/^[a-z0-9_]+\.mp3$/.test(asset.file) && !currentFiles.has(asset.file) && existsSync(join(OUT, asset.file))) unlinkSync(join(OUT, asset.file));
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
rmSync(tmp, { recursive: true, force: true });
console.log(`\n${Object.keys(manifest).length} prepared, ${skipped} skipped → public/audio/manifest.json`);
