import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { ASSETS } from '../src/config/assets.ts';

const publicRoot = new URL('../public/', import.meta.url);
let checked = 0;
async function file(path) {
  assert(!path.includes('..'), `Invalid asset path: ${path}`);
  const url = new URL(path.replace(/^\//, ''), publicRoot);
  assert((await stat(url)).size > 0, `Empty asset: ${path}`);
  checked++;
  return readFile(url);
}
for (const path of [ASSETS.poster, ASSETS.backdrop, '/favicon.svg', '/favicon.ico', '/favicon-32x32.png', '/apple-touch-icon.png']) await file(path);
const audio = JSON.parse(await file(`${ASSETS.audio}manifest.json`));
for (const clip of Object.values(audio)) {
  const data = await file(`${ASSETS.audio}${clip.file}`);
  assert.equal(createHash('sha256').update(data).digest('hex'), clip.sha256, `Audio checksum mismatch: ${clip.file}`);
  assert(clip.duration > 0, `Missing duration: ${clip.file}`);
}
assert.equal(`${ASSETS.audio}${audio.music_lounge.file}`, ASSETS.music);
const mascot = JSON.parse(await file(`${ASSETS.mascot}manifest.json`));
for (const name of ['welcome', 'idle', 'spin', 'win', 'loss']) {
  const clip = mascot.clips[name];
  assert(clip?.duration > 0 && clip.alpha.passed && clip.audio === false, `Invalid mascot clip: ${name}`);
  assert.equal((await file(`${ASSETS.mascot}${name}.mov`)).length, clip.hevc_bytes);
  assert.equal((await file(`${ASSETS.mascot}${name}.webm`)).length, clip.webm_bytes);
}
const fonts = await readFile(new URL('../src/fonts.css', import.meta.url), 'utf8');
for (const [, path] of fonts.matchAll(/url\('([^']+)'\)/g)) await file(path);
console.log(`Validated ${checked} runtime files, audio checksums, and both mascot video formats.`);
