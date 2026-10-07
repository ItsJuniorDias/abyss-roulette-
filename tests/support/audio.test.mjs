import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { transformSync } from 'esbuild';
const source = transformSync(readFileSync(new URL('../../src/providers/audio-session.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replaceAll('export ', ''),{loader:'ts'}).code
  + '\nthis.api = createAudioSession(document.getElementById("lounge-music"));';
const manifest = JSON.parse(readFileSync(new URL('../../public/audio/manifest.json', import.meta.url), 'utf8'));

function setup({ muted = false, blockFirstPlay = false, missingSamples = false } = {}) {
  const nodes = [], decoded = [], timers = new Map(), listeners = {};
  let contexts = 0, mediaSources = 0, timerId = 0;
  const param = () => ({ value: 0, setTargetAtTime(v) { this.value = v; },
    setValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; } });
  const node = (type) => {
    const value = { type, kind: type, gain: param(), frequency: param(), Q: param(), playbackRate: param(),
      connect(other) { this.to = other; return other; }, disconnect() { this.disconnected = true; },
      start() { this.started = true; }, stop() { this.stopped = true; this.onended?.(); } };
    nodes.push(value); return value;
  };
  let context;
  class AudioContext {
    constructor() { contexts++; context = this; this.currentTime = 0; this.sampleRate = 100; this.state = 'running'; this.destination = node('destination'); }
    createGain() { return node('gain'); }
    createDynamicsCompressor() { const n = node('compressor'); for (const k of ['threshold','knee','ratio','attack','release']) n[k] = param(); return n; }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return node('buffer'); }
    createOscillator() { return node('oscillator'); }
    createBiquadFilter() { return node('filter'); }
    createMediaElementSource(element) { mediaSources++; assert.equal(element, music); return node('media'); }
    async decodeAudioData(file) { decoded.push(file); return { file, duration: 5 }; }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() {this.state='closed';}
  }
  const music = { paused: true, plays: 0,
    play() { this.plays++; if (blockFirstPlay && this.plays === 1) return Promise.reject(new Error('Gesture required')); this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; }, remove() {this.removed=true;} };
  const document = { hidden: false, getElementById: () => music, addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name=>{delete listeners[name];} };
  const sandbox = { AbortController, ASSETS:{audio:'/audio/'}, window: { AudioContext }, navigator: {}, document,
    localStorage: { getItem: () => muted ? '1' : '0', setItem() {} },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
    fetch: async url => url.endsWith('manifest.json')
      ? { ok: true, headers: { get: () => 'application/json' }, json: async () => manifest }
      : { ok: !missingSamples, arrayBuffer: async () => url } };
  sandbox.window.setTimeout=sandbox.setTimeout;
  vm.runInNewContext(source, sandbox);
  return { api: sandbox.api, music, document, listeners, nodes, decoded, timers,
    get context() { return context; }, get contexts() { return contexts; }, get mediaSources() { return mediaSources; },
    ready: () => new Promise(resolve => setImmediate(resolve)),
    musicGain: () => nodes.find(n => n.type === 'media').to.gain };
}

test('first gesture starts one streaming player; only short effects are decoded', async () => {
  const t = setup(); assert.equal(t.contexts, 0);
  t.api.start(); await t.ready(); t.api.start();
  assert.equal(t.contexts, 1); assert.equal(t.mediaSources, 1); assert.equal(t.music.plays, 1);
  assert.equal(t.decoded.length, 10);
  assert.ok(t.decoded.every(url => url.includes('/sfx_') && url.includes('?v=')));
});

test('saved mute stays silent and unmute starts music without duplicating the graph', async () => {
  const t = setup({ muted: true }); t.api.start(); await t.ready();
  assert.equal(t.music.plays, 0); assert.equal(t.api.toggleMute(), false);
  assert.equal(t.music.paused, false); assert.equal(t.api.toggleMute(), true);
  t.api.start(); assert.equal(t.music.paused, true); assert.equal(t.music.plays, 1);
  assert.equal(t.mediaSources, 1);
});

test('a rejected play retries on the next real gesture', async () => {
  const t = setup({ blockFirstPlay: true }); t.api.start(); await t.ready();
  assert.equal(t.music.paused, true); t.api.start(); await t.ready();
  assert.equal(t.music.paused, false); assert.equal(t.music.plays, 2);
});

test('backgrounding pauses the stream and context; returning respects mute', async () => {
  const t = setup(); t.api.start(); await t.ready();
  t.document.hidden = true; t.listeners.visibilitychange();
  assert.equal(t.context.state, 'suspended'); assert.equal(t.music.paused, true);
  t.document.hidden = false; t.listeners.visibilitychange();
  assert.equal(t.context.state, 'running'); assert.equal(t.music.paused, false);
  t.api.toggleMute(); t.document.hidden = true; t.listeners.visibilitychange();
  t.document.hidden = false; t.listeners.visibilitychange(); assert.equal(t.music.paused, true);
});

test('spin ducks music, victory uses the new sample, and a new spin cancels restore', async () => {
  const t = setup(); t.api.start(); await t.ready(); const base = t.musicGain().value;
  t.api.spinStart(); assert.ok(t.musicGain().value < base);
  const rolling = t.api.rollLoop(); rolling.set(.5, 12); rolling.stop();
  assert.ok(t.nodes.some(n => n.buffer?.file?.includes('sfx_ball_roll_loop') && n.stopped && n.disconnected));
  t.api.result('win'); assert.ok(t.nodes.some(n => n.buffer?.file?.includes('sfx_win_fanfare') && n.started));
  assert.equal(t.timers.size, 1); t.api.spinStart(); assert.equal(t.timers.size, 0);
});

test('unavailable samples retain audible synthesis while music can stream', async () => {
  const t = setup({ missingSamples: true }); t.api.start(); await t.ready();
  t.api.chip(); t.api.result('win');
  assert.equal(t.music.paused, false); assert.equal(t.decoded.length, 0);
  assert.ok(t.nodes.some(n => n.kind === 'oscillator' && n.started));
});

test('dispose closes the mixer, pauses music and clears timers/listeners',async()=>{
 const t=setup();t.api.start();await t.ready();t.api.result('win');t.api.dispose();
 assert.equal(t.context.state,'closed');assert.equal(t.music.paused,true);assert.equal(t.music.removed,true);
 assert.equal(t.timers.size,0);assert.equal(t.listeners.visibilitychange,undefined);
});
