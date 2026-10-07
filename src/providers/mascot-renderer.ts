import type { Blend, FrameWatch } from '../interfaces/mascot.ts';
// Keep one visible backing store. iOS video surfaces can be discarded when a
// video ends, pauses or changes source; none of those operations clear this canvas.
export function createMascotRenderer(
  canvas: HTMLCanvasElement,
  poster: HTMLImageElement,
  videos: HTMLVideoElement[],
) {
  const width = canvas.width,
    height = canvas.height;
  const output = canvas.getContext('2d')!;
  const surface = (w = width, h = height, read = false) => {
    const image = document.createElement('canvas');
    image.width = w;
    image.height = h;
    return { image, context: image.getContext('2d', { willReadFrequently: read })! };
  };
  const scratch = surface(),
    sample = surface(16, 12, true);
  const frames = new Map(videos.map((video) => [video, { ...surface(), valid: false, time: -1 }]));
  const watchers = new Map<HTMLVideoElement, FrameWatch>();
  let visible: HTMLVideoElement | null = null;
  let blend: Blend | null = null;
  let fadeFrame: number | null = null;

  function clear(context: CanvasRenderingContext2D, w: number, h: number) {
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    // Explicitly erase transparent pixels as well as colored ones. Relying on
    // drawImage + "copy" left previous silhouettes on the reported iPhone path.
    context.clearRect(0, 0, w, h);
  }

  function capture(video: HTMLVideoElement): 'ready' | 'empty' | 'opaque' {
    const frame = frames.get(video)!;
    if (video.readyState < 2 || video.seeking || !video.videoWidth) return 'empty';
    try {
      clear(scratch.context, width, height);
      scratch.context.drawImage(video, 0, 0, width, height);
      clear(sample.context, 16, 12);
      sample.context.drawImage(scratch.image, 0, 0, 16, 12);
      const pixels = sample.context.getImageData(0, 0, 16, 12).data;
      let opaque = 0,
        transparent = 0;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] > 128) opaque++;
        if (pixels[i] < 20) transparent++;
      }
      // A transparent decoder frame must not replace the retained lion. An
      // opaque result means this browser decoded the color track without alpha.
      if (opaque < 8) return 'empty';
      if (transparent < 8) return 'opaque';
      // Commit only a validated frame. Swap private buffers instead of erasing
      // the retained one before a capture succeeds.
      [frame.image, scratch.image] = [scratch.image, frame.image];
      [frame.context, scratch.context] = [scratch.context, frame.context];
      frame.valid = true;
      frame.time = video.currentTime;
      return 'ready';
    } catch {
      return 'empty';
    }
  }
  const imageFor = (video: HTMLVideoElement | null) =>
    video
      ? frames.get(video)?.valid
        ? frames.get(video)!.image
        : null
      : poster.complete && poster.naturalWidth
        ? poster
        : null;
  function paint() {
    const incoming = imageFor(blend ? blend.next : visible);
    if (!incoming) return;
    const outgoing = blend && imageFor(blend.previous);
    const progress = outgoing ? blend!.progress : 1;
    // Weighted addition keeps equal poses equally opaque throughout the fade.
    // Both draws occur in one task, so a cleared intermediate frame is never shown.
    clear(output, width, height);
    output.globalAlpha = outgoing ? 1 - progress : 1;
    output.drawImage(outgoing || incoming, 0, 0, width, height);
    if (outgoing) {
      output.globalCompositeOperation = 'lighter';
      output.globalAlpha = progress;
      output.drawImage(incoming, 0, 0, width, height);
    }
    output.globalAlpha = 1;
    output.globalCompositeOperation = 'source-over';
  }
  function stop(video: HTMLVideoElement) {
    const watch = watchers.get(video);
    if (!watch) return;
    watch.stopped = true;
    if (watch.frame != null) video.cancelVideoFrameCallback?.(watch.frame);
    if (watch.paint != null) cancelAnimationFrame(watch.paint);
    watchers.delete(video);
  }
  function follow(video: HTMLVideoElement) {
    if (watchers.has(video)) return;
    const watch: FrameWatch = { stopped: false };
    watchers.set(video, watch);
    const tick = () => {
      if (watch.stopped) return;
      // Older Safari gets a bounded 24fps fallback; current browsers follow the
      // decoder's own frame callback instead of copying video at display refresh.
      const frame = frames.get(video)!;
      if (
        typeof video.requestVideoFrameCallback === 'function' ||
        Math.floor(video.currentTime * 24) !== Math.floor(frame.time * 24)
      ) {
        if (capture(video) === 'ready' && !blend && visible === video) paint();
      }
      schedule();
    };
    const schedule = () => {
      if (typeof video.requestVideoFrameCallback === 'function')
        watch.frame = video.requestVideoFrameCallback(tick);
      else watch.paint = requestAnimationFrame(tick);
    };
    schedule();
  }
  function cancelFade() {
    if (fadeFrame != null) cancelAnimationFrame(fadeFrame);
    fadeFrame = null;
    const current = blend;
    blend = null;
    current?.resolve(false);
  }
  function crossfade(
    next: HTMLVideoElement,
    previous: HTMLVideoElement | null,
    duration: number,
  ): Promise<boolean> {
    cancelFade();
    return new Promise((resolve) => {
      blend = { next, previous, progress: 0, resolve, started: null };
      const current = blend;
      follow(next);
      if (previous) follow(previous);
      paint();
      const tick = (now: number) => {
        if (blend !== current) return;
        current.started ??= now;
        const t = Math.min(1, (now - current.started) / duration);
        current.progress = t * t * (3 - 2 * t);
        paint();
        if (t < 1) fadeFrame = requestAnimationFrame(tick);
        else {
          visible = next;
          blend = null;
          fadeFrame = null;
          if (previous) stop(previous);
          resolve(true);
        }
      };
      fadeFrame = requestAnimationFrame(tick);
    });
  }
  return {
    capture,
    crossfade,
    follow,
    stop,
    reset(video: HTMLVideoElement) {
      stop(video);
      const frame = frames.get(video)!;
      frame.valid = false;
      frame.time = -1;
    },
    suspend() {
      videos.forEach(stop);
    },
    hide() {
      cancelFade();
      videos.forEach(stop);
      visible = null;
    },
  };
}
