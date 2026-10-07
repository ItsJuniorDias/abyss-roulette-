import { createMascotRenderer } from './mascot-renderer.js';

// Two persistent decoders feed one canvas: native loops and retained-frame fades.
// HEVC alpha for Safari; VP9 alpha for other compatible browsers.
const BASE = `${import.meta.env.BASE_URL}animations/ai/mascot-v1/`;
const stage = document.querySelector('.mascot-stage');
const still = document.getElementById('mascot');
const videos = [document.getElementById('mascot-video-a'), document.getElementById('mascot-video-b')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const loops = new Set(['idle', 'spin']);
const states = new Set(['welcome', 'idle', 'spin', 'win', 'loss']);
const FADE_MS = 300;
let requested = '', displayed = '', revision = 0, active = -1, pumping = false;
let loading = null, loadingVideo = null, preferredFormat = '', fallbackTimer;
const renderer = createMascotRenderer(document.getElementById('mascot-canvas'), still, videos);
stage.dataset.renderer = 'canvas-v2';

// Resolve only after a decoded frame is available. A timeout must never reveal a
// blank layer or hide the previous video. Abort also releases a pending play().
function decodedFrame(video, url, signal) {
  return new Promise((resolve, reject) => {
    let callback, paint, done = false;
    const finish = error => {
      if (done) return;
      done = true; clearTimeout(timer);
      if (callback != null) video.cancelVideoFrameCallback?.(callback);
      if (paint != null) cancelAnimationFrame(paint);
      signal.removeEventListener('abort', abort);
      video.removeEventListener('error', failed);
      video.removeEventListener('loadeddata', loaded);
      error ? reject(error) : resolve();
    };
    const abort = () => { video.pause(); finish(new DOMException('Superseded clip', 'AbortError')); };
    const failed = () => finish(new Error('Video could not be decoded'));
    const frame = () => {
      if (done) return;
      const result = renderer.capture(video);
      if (result === 'ready') { finish(); return; }
      if (result === 'opaque') { failed(); return; }
      if (video.requestVideoFrameCallback) callback = video.requestVideoFrameCallback(frame);
      else paint = requestAnimationFrame(frame);
    };
    const loaded = () => {
      if (!video.requestVideoFrameCallback && paint == null) paint = requestAnimationFrame(frame);
    };
    const timer = setTimeout(() => finish(new Error('No decoded video frame')), 8000);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    video.addEventListener('error', failed, { once: true });
    video.addEventListener('loadeddata', loaded);
    renderer.reset(video);
    if (video.getAttribute('src') !== url) video.src = url;
    else video.currentTime = 0; // Reuse the loaded, hidden layer without fetching again.
    if (video.requestVideoFrameCallback) callback = video.requestVideoFrameCallback(frame);
    video.play().then(loaded, failed);
  });
}
async function prepare(video, name, signal) {
  video.onended = null; video.loop = loops.has(name);
  video.muted = true; video.defaultMuted = true; video.playsInline = true;
  const formats = [
    ['mov', 'video/mp4; codecs="hvc1"'],
    ['webm', 'video/webm; codecs="vp9"'],
  ].filter(([, type]) => video.canPlayType(type))
    .sort(([a], [b]) => Number(b === preferredFormat) - Number(a === preferredFormat));
  for (const [extension] of formats) {
    if (signal.aborted) throw new DOMException('Superseded clip', 'AbortError');
    try {
      await decodedFrame(video, `${BASE}${name}.${extension}`, signal);
      if (signal.aborted) throw new DOMException('Superseded clip', 'AbortError');
      preferredFormat = extension;
      video.dataset.clip = name;
      if (document.hidden) video.pause();
      return extension;
    } catch (error) {
      video.pause();
      if (signal.aborted) throw error;
    }
  }
  throw new Error('No compatible alpha video');
}
function poster() {
  renderer.hide();
  videos.forEach(video => { video.pause(); video.onended = null; video.classList.remove('active'); });
  stage.classList.remove('video-ready');
  active = -1; displayed = '';
  stage.dataset.activeState = ''; stage.dataset.transition = 'poster'; stage.dataset.format = 'poster';
}
async function crossfade(next, previous) {
  stage.dataset.transition = 'fade';
  // Paint before hiding the poster. Only the stable canvas is ever visible;
  // pausing/reusing either hardware decoder cannot expose a blank video surface.
  next.classList.add('active');
  const completed = renderer.crossfade(next, previous, FADE_MS);
  stage.classList.add('video-ready');
  return completed;
}
async function pump() {
  if (pumping || reduced.matches || requested === displayed) return;
  pumping = true;
  try {
    while (!reduced.matches && requested !== displayed) {
      const name = requested, version = revision;
      const index = active === 0 ? 1 : 0, next = videos[index];
      const controller = new AbortController(); loading = controller; loadingVideo = next;
      stage.dataset.transition = 'loading';
      let format;
      try { format = await prepare(next, name, controller.signal); }
      catch {
        if (version !== revision) continue;
        // Keep the last visible frame on network/codec failure; never flash the poster.
        if (active < 0) poster();
        else stage.dataset.transition = 'holding';
        if (!loops.has(name)) fallbackTimer = setTimeout(() => {
          if (version === revision) setMascotState('idle');
        }, 5250);
        break;
      } finally { loading = null; loadingVideo = null; }
      if (version !== revision || reduced.matches) continue;
      const previous = active >= 0 ? videos[active] : null;
      // A request during this fade is queued. Neither visible layer can be reused
      // for another source until the current blend has completed.
      if (!(await crossfade(next, previous))) continue;
      previous?.pause();
      next.classList.add('active'); previous?.classList.remove('active');
      active = index; displayed = name;
      stage.dataset.activeState = name; stage.dataset.format = format; stage.dataset.transition = 'steady';
      next.onended = () => {
        if (videos[active] === next && requested === name && !loops.has(name)) setMascotState('idle');
      };
      if (next.ended) next.onended();
      if (document.hidden) next.pause();
    }
  } finally {
    pumping = false;
    if (active >= 0 && requested === displayed && !reduced.matches) stage.dataset.transition = 'steady';
  }
}
export function setMascotState(name) {
  if (!states.has(name)) return;
  if (name === requested) {
    // Repeated game updates do not reset currentTime, src, the native loop, or opacity.
    if (!pumping && !reduced.matches && name === displayed) {
      const video = videos[active];
      if (video.paused && !video.ended && !document.hidden) video.play().then(() => renderer.follow(video)).catch(() => {});
    } else pump();
    return;
  }
  requested = name; revision++; clearTimeout(fallbackTimer);
  stage.dataset.state = name;
  loading?.abort();
  if (reduced.matches) { poster(); return; }
  pump();
}
reduced.addEventListener('change', () => {
  revision++; clearTimeout(fallbackTimer); loading?.abort();
  if (reduced.matches) poster();
  else pump();
});
function resumePlayback() {
  if (document.hidden || reduced.matches) return;
  for (const video of videos) {
    if (video.paused && !video.ended && (video === videos[active] || video === loadingVideo || video.classList.contains('active'))) {
      video.play().then(() => {
        if (video !== loadingVideo) renderer.follow(video);
      }).catch(() => {});
    }
  }
  pump();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { videos.forEach(video => video.pause()); renderer.suspend(); }
  else resumePlayback();
});
// Low Power Mode can reject autoplay. Retry on the first real interaction while
// retaining the poster/current frame, then keep normal inline playback.
document.addEventListener('pointerup', resumePlayback);
document.addEventListener('keydown', resumePlayback);
setMascotState('welcome');
