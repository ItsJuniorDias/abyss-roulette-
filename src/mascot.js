// Continuous AI performances. HEVC alpha for Safari, VP9 alpha for other browsers.
const BASE = `${import.meta.env.BASE_URL}animations/ai/mascot-v1/`;
const stage = document.querySelector('.mascot-stage');
const videos = [document.getElementById('mascot-video-a'), document.getElementById('mascot-video-b')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const loops = new Set(['idle', 'spin']);
const states = new Set(['welcome', 'idle', 'spin', 'win', 'loss']);
let state = '', revision = 0, active = -1, fallbackTimer;
const alphaCanvas = document.createElement('canvas'); alphaCanvas.width = alphaCanvas.height = 2;
const context = alphaCanvas.getContext('2d', { willReadFrequently: true });

function frameReady(video) {
  return new Promise(resolve => {
    let callback, settled = false;
    const done = () => { if (settled) return; settled = true; clearTimeout(timer); if (callback && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(callback); resolve(); };
    const timer = setTimeout(done, 1200);
    if (video.requestVideoFrameCallback) callback = video.requestVideoFrameCallback(done);
    else setTimeout(done, 80);
  });
}
function hasAlpha(video) {
  context.clearRect(0, 0, 2, 2);
  context.drawImage(video, 0, 0, 2, 2, 0, 0, 2, 2);
  return context.getImageData(0, 0, 1, 1).data[3] < 20;
}
function poster() {
  videos.forEach(video => { video.pause(); video.classList.remove('active'); });
  stage.classList.remove('video-ready'); active = -1;
}
export function setMascotState(name, force = false) {
  if (!states.has(name) || (name === state && !force)) return;
  state = name; const version = ++revision; clearTimeout(fallbackTimer);
  stage.dataset.state = name;
  if (reduced.matches) { poster(); return; }
  const index = active === 0 ? 1 : 0, next = videos[index];
  next.pause(); next.onended = null; next.loop = loops.has(name);
  next.muted = true; next.defaultMuted = true;
  const formats = [
    ['mov', 'video/mp4; codecs="hvc1"'],
    ['webm', 'video/webm; codecs="vp9"'],
  ].filter(([, type]) => next.canPlayType(type));
  (async () => {
    for (const [extension] of formats) {
      if (version !== revision) return;
      try {
        next.src = `${BASE}${name}.${extension}`;
        await next.play(); await frameReady(next);
        if (version !== revision || reduced.matches) return;
        if (!hasAlpha(next)) { next.pause(); continue; }
        const previous = active >= 0 ? videos[active] : null;
        stage.dataset.format = extension;
        next.classList.add('active'); stage.classList.add('video-ready');
        if (previous && previous !== next) { previous.classList.remove('active'); previous.pause(); }
        active = index;
        next.onended = () => { if (version === revision && !loops.has(name)) setMascotState('idle'); };
        if (document.hidden) next.pause();
        return;
      } catch { /* Try the other alpha codec; never display an opaque rectangle. */ }
    }
    if (version !== revision) return;
    poster(); stage.dataset.format = 'poster';
    if (!loops.has(name)) fallbackTimer = setTimeout(() => { if (version === revision) setMascotState('idle'); }, 5250);
  })();
}
reduced.addEventListener('change', () => setMascotState(state || 'idle', true));
document.addEventListener('visibilitychange', () => {
  if (active < 0) return;
  const video = videos[active];
  if (document.hidden) video.pause();
  else if (!reduced.matches) video.play().catch(() => poster());
});
setMascotState('welcome');
