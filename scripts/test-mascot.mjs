import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const renderer = readFileSync(new URL('../src/mascot-renderer.js', import.meta.url), 'utf8');
const player = readFileSync(new URL('../src/mascot.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/, '').replace('import.meta.env.BASE_URL', "'/'");
const source = (renderer + '\n' + player).replaceAll('export ', '') + '\nthis.setState = setMascotState;';

function setup({ frameCallbacks = true, copyAsSourceOver = false, initialPixels = [0,0,1,1] } = {}) {
  const timers = new Map(), raf = new Map(), motionListeners = [], docListeners = {};
  let nextId = 0, clock = 0;
  const classes = () => { const values = new Set(); return { add: (...v) => v.forEach(x => values.add(x)), remove: (...v) => v.forEach(x => values.delete(x)), contains: v => values.has(v) }; };
  const element = id => ({ id, classList: classes(), dataset: {} });
  // Two representative premultiplied pixels: transparent background + lion.
  // Canvas operations retain copies, so releasing a decoder cannot erase them.
  const lion = () => [...initialPixels];
  function canvas(id = '') {
    const image = { ...element(id), width: 640, height: 480, pixels: [0,0,0,0] };
    const ctx = { globalAlpha: 1, globalCompositeOperation: 'source-over',
      clearRect() { image.pixels = image.pixels.map(() => 0); },
      drawImage(src) {
        if (src.broken) throw new Error('decoder unavailable');
        const pixels = src.pixels.map(v => v * this.globalAlpha);
        const operation = this.globalCompositeOperation === 'copy' && copyAsSourceOver
          ? 'source-over' : this.globalCompositeOperation;
        if (operation === 'copy') image.pixels = [...pixels];
        else {
          image.pixels = Array.from({length:Math.max(pixels.length,image.pixels.length)}, (_,i) => {
            const value=pixels[i] || 0, previous=image.pixels[i] || 0;
            if (operation === 'lighter') return Math.min(1,value+previous);
            const alpha=pixels[i-i%2+1] || 0;
            return value+previous*(1-alpha);
          });
        }
      },
      getImageData() {
        const data = new Uint8ClampedArray(16*12*4);
        for (let i=0; i<192; i++) {
          const offset=Math.floor(i*(image.pixels.length/2)/192)*2;
          data[i*4]=image.pixels[offset]*255; data[i*4+3]=image.pixels[offset+1]*255;
        }
        return { data };
      },
    };
    image.getContext = () => ctx;
    return image;
  }
  function video(id) {
    const v = element(id), callbacks = new Map(), listeners = {};
    let src = '', time = 0;
    Object.assign(v, { paused: true, ended: false, readyState: 4, videoWidth: 640, autoFrame: true, writes: 0, seeks: 0, plays: 0, loops: 0, pixels: lion(),
      canPlayType: type => type.includes('webm') ? 'probably' : '', getAttribute: name => name === 'src' ? src : null,
      addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => { delete listeners[name]; },
      requestVideoFrameCallback: fn => { callbacks.set(++nextId, fn); return nextId; }, cancelVideoFrameCallback: id => callbacks.delete(id),
      frame() { for (const [id, fn] of [...callbacks]) { callbacks.delete(id); fn(); } },
      play() { this.plays++; if (this.fail?.(src)) return Promise.reject(new Error('decode failed')); this.paused = false; if (this.autoFrame) queueMicrotask(() => this.frame()); return Promise.resolve(); },
      pause() { this.paused = true; },
      end() { if (this.loop) { time = 0; this.loops++; } else { this.ended = true; this.paused = true; this.onended?.(); } },
    });
    if (!frameCallbacks) delete v.requestVideoFrameCallback;
    Object.defineProperties(v, {
      src: { get: () => src, set: value => { src = value; v.writes++; time = 0; v.ended = false; } },
      currentTime: { get: () => time, set: value => { time = value; v.seeks++; v.ended = false; } },
    });
    return v;
  }
  const stage = element('stage'), still = { ...element('mascot'), complete:true, naturalWidth:640, pixels:lion() };
  const output = canvas('mascot-canvas'), videos = [video('mascot-video-a'),video('mascot-video-b')];
  const reduced = { matches: false, addEventListener: (_name, fn) => motionListeners.push(fn) };
  const document = { hidden: false, querySelector: () => stage,
    getElementById: id => id === 'mascot' ? still : id === 'mascot-canvas' ? output : videos.find(v => v.id === id),
    createElement: () => canvas(), addEventListener: (name, fn) => { docListeners[name] = fn; } };
  const sandbox = { document, matchMedia: () => reduced, AbortController, DOMException,
    setTimeout: (fn, ms) => { timers.set(++nextId,{ fn, ms }); return nextId; }, clearTimeout: id => timers.delete(id),
    requestAnimationFrame: fn => { raf.set(++nextId,fn); return nextId; }, cancelAnimationFrame: id => raf.delete(id) };
  vm.runInNewContext(source, sandbox);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  return { stage, videos, output, timers, reduced, document, setState: sandbox.setState, flush,
    async tick(ms = 16) { clock += ms; const current=[...raf]; raf.clear(); current.forEach(([,fn])=>fn(clock)); await flush(); },
    async finishFade() { await this.tick(); await this.tick(300); },
    async ready() { await flush(); if (!frameCallbacks) await this.tick(); await this.finishFade(); },
    async motion(value) { reduced.matches=value; motionListeners.forEach(fn=>fn()); await flush(); },
    async visibility(hidden) { document.hidden=hidden; docListeners.visibilitychange(); await flush(); },
    async tap() { docListeners.pointerup(); await flush(); },
  };
}

test('welcome starts without a gesture, then fades to native-loop idle', async () => {
  const t=setup(); await t.flush();
  assert.ok(t.videos[0].plays > 0); assert.equal(t.videos[0].muted,true); assert.equal(t.videos[0].playsInline,true);
  assert.equal(t.stage.dataset.transition,'fade');
  await t.finishFade(); assert.equal(t.stage.dataset.activeState,'welcome');
  t.videos[0].end(); await t.flush();
  assert.equal(t.stage.dataset.state,'idle'); assert.equal(t.stage.classList.contains('video-ready'),true);
  await t.finishFade(); assert.equal(t.stage.dataset.activeState,'idle'); assert.equal(t.videos[1].loop,true);
});

test('same state preserves src and time, while native loops retain a visible frame', async () => {
  const t=setup(); await t.ready(); t.setState('idle'); await t.flush(); await t.finishFade();
  const idle=t.videos[1]; idle.currentTime=2.7;
  const writes=idle.writes, seeks=idle.seeks;
  t.setState('idle'); t.setState('idle'); await t.flush();
  assert.equal(idle.currentTime,2.7); assert.equal(idle.writes,writes); assert.equal(idle.seeks,seeks);
  idle.end(); idle.seeking=true; idle.pixels=[0,0,0,0]; idle.frame(); await t.flush();
  assert.equal(idle.loops,1); assert.equal(idle.paused,false); assert.equal(t.output.pixels[3],1);
});

test('slow loading retains the outgoing frame even when iOS releases its ended video surface', async () => {
  const t=setup(); await t.ready(); const [old,next]=t.videos; next.autoFrame=false;
  old.end(); await t.flush();
  old.pixels=[0,0,0,0]; old.frame();
  assert.equal(t.stage.dataset.transition,'loading'); assert.equal(t.output.pixels[3],1);
  next.frame(); await t.flush(); await t.finishFade();
  assert.equal(t.stage.dataset.activeState,'idle'); assert.equal(t.output.pixels[3],1);
});

test('crossfade uses retained pixels and never dims equal poses at the midpoint', async () => {
  const t=setup(); await t.ready(); t.setState('spin'); await t.flush();
  await t.tick(); await t.tick(150);
  assert.equal(t.stage.dataset.transition,'fade'); assert.equal(t.output.pixels[3],1);
  t.videos[0].pixels=[0,0,0,0]; t.videos[0].frame();
  await t.tick(150);
  assert.equal(t.output.pixels[3],1); assert.equal(t.stage.dataset.activeState,'spin');
});

test('changes during a fade queue only the latest request without recycling visible buffers', async () => {
  const t=setup(); await t.ready(); t.setState('spin'); await t.flush();
  const [old,next]=t.videos, oldSrc=old.src, newSrc=next.src;
  t.setState('win'); t.setState('loss'); await t.flush();
  assert.equal(old.src,oldSrc); assert.equal(next.src,newSrc);
  await t.finishFade(); assert.ok(old.src.endsWith('loss.webm')); assert.equal(next.src,newSrc);
  await t.finishFade(); assert.equal(t.stage.dataset.activeState,'loss'); assert.equal(t.output.pixels[3],1);
});

test('empty incoming frames wait for actual lion pixels before fading', async () => {
  const t=setup(); await t.ready(); const next=t.videos[1]; next.pixels=[0,0,0,0];
  t.setState('spin'); await t.flush();
  assert.equal(t.stage.dataset.transition,'loading'); assert.equal(t.output.pixels[3],1);
  next.pixels=[0,0,1,1]; next.frame(); await t.flush(); await t.finishFade();
  assert.equal(t.stage.dataset.activeState,'spin');
});

test('decode timeout keeps the canvas and never flashes the poster', async () => {
  const t=setup(); await t.ready(); t.videos[1].autoFrame=false;
  t.setState('idle'); await t.flush();
  const timeout=[...t.timers.values()].find(timer=>timer.ms===8000); assert.ok(timeout); timeout.fn(); await t.flush();
  assert.equal(t.stage.dataset.transition,'holding'); assert.equal(t.stage.dataset.activeState,'welcome');
  assert.equal(t.stage.classList.contains('video-ready'),true); assert.equal(t.output.pixels[3],1);
});

test('reduced motion cancels a fade without resurrecting playback', async () => {
  const t=setup(); await t.ready(); t.setState('spin'); await t.flush();
  await t.motion(true);
  assert.equal(t.stage.classList.contains('video-ready'),false); assert.ok(t.videos.every(v=>v.paused));
  assert.equal(t.stage.dataset.transition,'poster');
  await t.motion(false); await t.finishFade(); assert.equal(t.stage.dataset.activeState,'spin');
});

test('superseding a pending load with the current state preserves playback', async () => {
  const t=setup(); await t.ready(); t.videos[1].autoFrame=false;
  t.setState('spin'); await t.flush(); t.setState('welcome'); await t.flush();
  assert.equal(t.stage.dataset.activeState,'welcome'); assert.equal(t.stage.dataset.transition,'steady');
  assert.equal(t.videos[0].paused,false); assert.equal(t.videos[1].paused,true);
});

test('older Safari without frame callbacks still starts and paints the video', async () => {
  const t=setup({frameCallbacks:false}); await t.ready();
  assert.equal(t.stage.dataset.activeState,'welcome'); assert.equal(t.output.pixels[3],1);
});

test('backgrounding and resuming preserve the canvas and restart playback', async () => {
  const t=setup(); await t.ready(); await t.visibility(true);
  assert.ok(t.videos.every(v=>v.paused)); assert.equal(t.output.pixels[3],1);
  await t.visibility(false); assert.equal(t.videos[0].paused,false);
  t.videos[0].pixels=[0,0,0.5,1]; t.videos[0].frame();
  assert.equal(t.output.pixels[2],0.5); assert.equal(t.output.pixels[3],1);
});

test('resuming halfway through a fade restarts both decoders', async () => {
  const t=setup(); await t.ready(); t.setState('spin'); await t.flush(); await t.tick(); await t.tick(100);
  await t.visibility(true); assert.ok(t.videos.every(v=>v.paused));
  await t.visibility(false); assert.ok(t.videos.every(v=>!v.paused));
  await t.tick(200); assert.equal(t.stage.dataset.activeState,'spin'); assert.equal(t.output.pixels[3],1);
});

test('a gesture retries blocked autoplay without removing the retained image', async () => {
  const t=setup(); await t.ready(); t.videos[1].fail=()=>true;
  t.setState('spin'); await t.flush();
  assert.equal(t.stage.dataset.transition,'holding'); assert.equal(t.output.pixels[3],1);
  t.videos[1].fail=()=>false; await t.tap(); await t.finishFade();
  assert.equal(t.stage.dataset.activeState,'spin'); assert.equal(t.videos[1].paused,false);
});

test('a codec that loses transparency never paints an opaque rectangle', async () => {
  const t=setup(); await t.ready(); t.videos[1].pixels=[1,1,1,1];
  t.setState('spin'); await t.flush();
  assert.equal(t.stage.dataset.transition,'holding'); assert.equal(t.output.pixels[1],0);
  assert.equal(t.output.pixels[3],1); assert.equal(t.stage.dataset.activeState,'welcome');
});

test('moving transparent silhouettes leave no trails even if copy behaves as source-over', async () => {
  const left=[0,0,0.4,1,0.8,1,0,0], right=[0,0,0.4,1,0,0,0.9,1];
  const t=setup({copyAsSourceOver:true,initialPixels:left}); await t.ready();
  for (let i=0;i<30;i++) {
    const expected=i%2 ? left : right;
    t.videos[0].pixels=[...expected]; t.videos[0].currentTime=(i+1)/24; t.videos[0].frame();
    assert.deepEqual(Array.from(t.output.pixels),expected,`old silhouette remained at frame ${i}`);
  }
});

test('a completed fade removes the outgoing silhouette without accumulating prior blends', async () => {
  const left=[0,0,0.4,1,0.8,1,0,0], right=[0,0,0.4,1,0,0,0.9,1];
  const t=setup({copyAsSourceOver:true,initialPixels:left}); await t.ready();
  t.videos[1].pixels=right; t.setState('spin'); await t.flush(); await t.tick();
  for (let i=0;i<10;i++) await t.tick(30);
  assert.equal(t.stage.dataset.activeState,'spin');
  assert.deepEqual(Array.from(t.output.pixels),right);
});
