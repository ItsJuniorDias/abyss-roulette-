#!/usr/bin/env python3
"""Generate Aurum animations with OpenRouter/HeyGen, then key green to alpha.

Python 3.9+, standard library only. FFmpeg/ffprobe are required for media work.
See design-system/animations/ai-video/README.txt for commands and limitations.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from fractions import Fraction
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / 'design-system/animations/ai-video/openrouter-presets.json'
API = 'https://openrouter.ai/api/v1'
MODEL = 'heygen/heygen-video-1'
REFERENCE_PATH = 'animations/ai/aurum-bust-reference-v1.png'


class VideoError(Exception):
    pass


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def save_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    temp.replace(path)


def load_env(path):
    """Read KEY=value without executing shell expressions or replacing exported values."""
    if not path.is_file():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        match = re.fullmatch(r'(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)', line)
        if not match:
            continue
        key, value = match.groups()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in '\"\'':
            value = value[1:-1]
        else:
            value = value.split(' #', 1)[0].strip()
        os.environ.setdefault(key, value)


def redact(message):
    key = os.environ.get('OPENROUTER_API_KEY', '')
    return str(message).replace(key, '[REDACTED]') if key else str(message)


def https_url(url):
    parts = urlsplit(url)
    if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password:
        raise VideoError('A public HTTPS URL without embedded credentials is required.')
    return url


def api_url(url):
    url = urljoin('https://openrouter.ai', url)
    parts = urlsplit(https_url(url))
    if parts.netloc != 'openrouter.ai' or not (parts.path == '/api/v1/videos' or parts.path.startswith('/api/v1/videos/')):
        raise VideoError('Refusing to send the API key outside OpenRouter video endpoints.')
    return url


class SafeRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        https_url(newurl)
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected and urlsplit(req.full_url).netloc != urlsplit(newurl).netloc:
            redirected.remove_header('Authorization')
        return redirected


class Client:
    def __init__(self, key=''):
        self.key = key
        self.opener = build_opener(SafeRedirect())

    def open(self, url, method='GET', payload=None, authenticated=True):
        url = api_url(url) if authenticated else https_url(url)
        headers = {'User-Agent': 'AurumClub-Video/1.0', 'Accept': 'application/json'}
        if authenticated:
            if not self.key:
                raise VideoError('Set OPENROUTER_API_KEY in the project .env file.')
            headers['Authorization'] = 'Bearer ' + self.key
            headers['X-Title'] = 'Aurum Club animation production'
        data = None
        if payload is not None:
            data = json.dumps(payload).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        try:
            return self.opener.open(Request(url, data=data, headers=headers, method=method), timeout=60)
        except HTTPError as exc:
            detail = redact(exc.read(2000).decode('utf-8', errors='replace'))
            if self.key:
                detail = detail.replace(self.key, '[REDACTED]')
            note = ' Submission was NOT retried; check OpenRouter Activity before resubmitting.' if method == 'POST' else ''
            raise VideoError('HTTP %s: %s%s' % (exc.code, detail, note)) from None
        except (URLError, TimeoutError, OSError) as exc:
            note = ' Submission was NOT retried; check OpenRouter Activity before resubmitting.' if method == 'POST' else ''
            raise VideoError(redact(str(exc)) + note) from None

    def json(self, url, method='GET', payload=None, authenticated=True):
        with self.open(url, method, payload, authenticated) as response:
            return json.load(response)

    def models(self):
        data = self.json(API + '/videos/models', authenticated=False)
        return next((item for item in data['data'] if item['id'] == MODEL), None)

    def download(self, job, destination):
        # Use the documented content endpoint; redirect handler strips credentials at a CDN.
        url = API + '/videos/' + quote(job['id'], safe='') + '/content?index=0'
        destination = Path(destination)
        temp = destination.with_suffix('.part')
        with self.open(url) as response, temp.open('wb') as out:
            if 'json' in response.headers.get('Content-Type', ''):
                raise VideoError('The content endpoint returned JSON instead of a video.')
            shutil.copyfileobj(response, out)
        if not temp.stat().st_size:
            raise VideoError('Downloaded video was empty.')
        temp.replace(destination)


def media(command):
    if not shutil.which(command[0]):
        raise VideoError('Install %s before running this command.' % command[0])
    result = subprocess.run(command, capture_output=True)
    if result.returncode:
        raise VideoError(result.stderr.decode('utf-8', errors='replace')[-2000:])
    return result.stdout


def probe(path):
    return json.loads(media(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))


def prepare_reference(config):
    source = ROOT / config['reference']
    target = ROOT / 'public' / REFERENCE_PATH
    fingerprint = hashlib.sha256(source.read_bytes()).hexdigest()
    stamp = target.with_suffix('.json')
    if config.get('reference_mode') != 'green_first_frame':
        raise VideoError('Provide the approved waist-up green first frame in the presets.')
    if not target.exists() or not stamp.exists() or read_json(stamp).get('source_sha256') != fingerprint:
        target.parent.mkdir(parents=True, exist_ok=True)
        # Publish the SAME first frame for every clip; never redraw the identity per state.
        shutil.copy2(source, target)
        save_json(stamp, {'source_sha256': fingerprint, 'background': 'green',
                         'framing': 'waist-up', 'aspect_ratio': config['aspect_ratio']})
    # The running tunnel serves dist. Also keep the source under public for future builds.
    if (ROOT / 'dist').is_dir():
        published = ROOT / 'dist' / REFERENCE_PATH
        published.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, published)
    return target


def reference_url(explicit=None):
    if explicit:
        return https_url(explicit)
    base = os.environ.get('OPENROUTER_ASSET_BASE_URL', '').strip()
    tunnel = ROOT / 'tmp/tunnel/active.json'
    if not base and tunnel.is_file():
        base = read_json(tunnel).get('url', '')
    if not base:
        raise VideoError('Set OPENROUTER_ASSET_BASE_URL or pass --reference-url with the green reference image URL.')
    return https_url(base.rstrip('/') + '/' + REFERENCE_PATH)


def check_reference(client, url):
    with client.open(url, method='HEAD', authenticated=False) as response:
        if not response.headers.get('Content-Type', '').startswith('image/'):
            raise VideoError('Reference URL must return an image, not an HTML login/preview page.')


def build_request(config, animation, model, image_url, resolution):
    if not model or model.get('id') != MODEL:
        raise VideoError('The requested heygen/heygen-video-1 model is not available; no fallback was selected.')
    preset = config['animations'][animation]
    aspect = config['aspect_ratio']
    for field, value in [('durations', preset['duration']), ('resolutions', resolution), ('aspect_ratios', aspect)]:
        if value not in (model.get('supported_' + field) or []):
            raise VideoError('Unsupported %s: %s' % (field, value))
    if 'first_frame' not in (model.get('supported_frame_images') or []):
        raise VideoError('The selected model does not advertise first-frame input.')
    return {'model': MODEL, 'prompt': config['common_prompt'] + ' ' + preset['motion'],
            'duration': preset['duration'], 'resolution': resolution, 'aspect_ratio': aspect,
            # HeyGen always produces audio and rejects False (HTTP 400).
            # The catalog flag is not permission to disable it; exports use -an.
            'generate_audio': True,
            'frame_images': [{'type': 'image_url', 'image_url': {'url': https_url(image_url)}, 'frame_type': 'first_frame'}]}


def wait_for_job(client, job, job_file, timeout=1200, interval=15):
    deadline = time.monotonic() + timeout
    while True:
        save_json(job_file, job)
        status = job.get('status')
        print('Video status: %s' % status, flush=True)
        if status == 'completed':
            return job
        if status in ('failed', 'cancelled', 'expired'):
            raise VideoError('Generation %s: %s. Job saved at %s' % (status, redact(job.get('error', '')), job_file))
        if status not in ('pending', 'in_progress'):
            raise VideoError('Unknown job status; saved at %s. No new job was submitted.' % job_file)
        if time.monotonic() >= deadline:
            raise VideoError('Wait timed out. Resume this job without paying for another: %s' % job_file)
        time.sleep(min(interval, max(0, deadline - time.monotonic())))
        url = job.get('polling_url') or API + '/videos/' + quote(job['id'], safe='')
        job = client.json(api_url(url))


def alpha_report(path, duration):
    samples = []
    for position in (0.0, duration * .5, max(0, duration - .15)):
        raw = media(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-c:v', 'libvpx-vp9',
                     '-i', str(path), '-ss', str(position), '-frames:v', '1',
                     '-vf', 'alphaextract,scale=64:64', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'])
        if not raw:
            raise VideoError('Could not decode an alpha sample.')
        transparent = sum(v < 16 for v in raw) / len(raw)
        opaque = sum(v > 239 for v in raw) / len(raw)
        samples.append({'time': position, 'transparent_fraction': transparent, 'opaque_fraction': opaque})
    return {'passed': all(s['transparent_fraction'] > .01 and s['opaque_fraction'] > .01 for s in samples),
            'samples': samples, 'visual_review_required': True,
            'note': 'Pixel alpha check only. Review mane, hands, waist anchor, shadows and loop continuity visually.'}


def process_video(source, out, similarity=.16, blend=.06):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    info = probe(source)
    stream = next(s for s in info['streams'] if s['codec_type'] == 'video')
    width, height = int(stream['width']), int(stream['height'])
    duration = float(info['format']['duration'])
    fps = str(Fraction(stream.get('avg_frame_rate', '30/1')) or Fraction(30))
    key = 'format=yuva444p,chromakey=0x00ff00:%s:%s,format=rgba,despill=type=green:mix=1' % (similarity, blend)
    webm, master, preview = out / 'transparent.webm', out / 'master.mov', out / 'preview.mp4'
    media(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
           '-vf', key, '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0',
           '-crf', '24', '-auto-alt-ref', '0', str(webm),
           '-vf', key, '-an', '-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le',
           '-alpha_bits', '16', str(master)])
    report = alpha_report(webm, duration)
    save_json(out / 'alpha-report.json', report)
    if not report['passed']:
        raise VideoError('Alpha check failed. Files kept for inspection; adjust --similarity/--blend using process.')
    media(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
           '-f', 'lavfi', '-i', 'color=c=0x0d2920:s=%sx%s:r=%s' % (width, height, fps),
           '-c:v', 'libvpx-vp9', '-i', str(webm), '-filter_complex',
           '[0:v][1:v]overlay=shortest=1:format=auto,format=yuv420p[out]', '-map', '[out]',
           '-an', '-c:v', 'libx264', '-crf', '18', '-movflags', '+faststart', str(preview)])
    save_json(out / 'exports.json', {'source': str(Path(source).resolve()), 'model': MODEL,
              'duration': duration, 'size': [width, height], 'alpha_method': 'green-screen chroma key after generation',
              'audio_removed': True, 'files': [str(webm), str(master), str(preview)], 'visual_review_required': True})
    print('Exports ready for visual review: %s' % out, flush=True)


def finish_job(client, job, folder, timeout):
    job = wait_for_job(client, job, folder / 'job.json', timeout)
    raw = folder / 'source.mp4'
    if not raw.exists():
        client.download(job, raw)
    process_video(raw, folder)
    if job.get('usage'):
        print('Usage: ' + json.dumps(job['usage']))


def main():
    load_env(ROOT / '.env')
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('prepare', help='Prepare the green reference image without generating video')
    sub.add_parser('models', help='Read current model capabilities without spending credits')
    for name in ('plan', 'generate'):
        p = sub.add_parser(name)
        p.add_argument('animation', nargs='?', default='welcome', help='welcome, idle, spin, win, loss, or all')
        p.add_argument('--reference-url')
        p.add_argument('--resolution', default=os.environ.get('OPENROUTER_VIDEO_RESOLUTION') or '768p')
        p.add_argument('--timeout', type=int, default=1200)
    resume = sub.add_parser('resume', help='Continue a saved job; never submits a new paid generation')
    resume.add_argument('job', type=Path)
    resume.add_argument('--timeout', type=int, default=1200)
    process = sub.add_parser('process', help='Key an existing green-screen video without making API calls')
    process.add_argument('video', type=Path)
    process.add_argument('--out', type=Path, required=True)
    process.add_argument('--similarity', type=float, default=.16)
    process.add_argument('--blend', type=float, default=.06)
    args = parser.parse_args()
    if args.command == 'process':
        if not .00001 <= args.similarity <= 1 or not 0 <= args.blend <= 1:
            raise VideoError('Similarity must be in (0, 1] and blend in [0, 1].')
        process_video(args.video.resolve(), args.out.resolve(), args.similarity, args.blend)
        return
    client = Client(os.environ.get('OPENROUTER_API_KEY', '').strip())
    if args.command == 'resume':
        finish_job(client, read_json(args.job), args.job.resolve().parent, args.timeout)
        return
    config = read_json(CONFIG)
    if args.command == 'prepare':
        print(prepare_reference(config))
        return
    model = client.models()
    if args.command == 'models':
        print(json.dumps(model, indent=2))
        return
    names = list(config['animations']) if args.animation == 'all' else [args.animation]
    if any(name not in config['animations'] for name in names):
        raise VideoError('Choose welcome, idle, spin, win, loss, or all.')
    if args.command == 'generate' and (not client.key or client.key.endswith('...')):
        raise VideoError('Set OPENROUTER_API_KEY in %s; do not put it in the frontend.' % (ROOT / '.env'))
    if not args.reference_url:
        prepare_reference(config)
    url = reference_url(args.reference_url)
    check_reference(client, url)
    for name in names:
        request = build_request(config, name, model, url, args.resolution)
        rate = model.get('pricing_skus', {}).get('duration_seconds_' + args.resolution.lower())
        estimate = float(rate) * request['duration'] if rate else None
        print(json.dumps({'animation': name, 'catalog_estimate_usd': estimate,
                          'native_alpha': 'not advertised; green screen + FFmpeg', 'request': request}, indent=2))
        if args.command == 'plan':
            continue
        for binary in ('ffmpeg', 'ffprobe'):
            if not shutil.which(binary):
                raise VideoError('Install %s before submitting a paid job.' % binary)
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        folder = ROOT / 'output/ai-video' / name / stamp
        save_json(folder / 'request.json', request)
        save_json(folder / 'submission.json', {'state': 'submitting', 'submitted_at': stamp})
        print('Submitting one video; request saved at %s' % folder, flush=True)
        job = client.json(API + '/videos', method='POST', payload=request)
        save_json(folder / 'job.json', job)
        save_json(folder / 'submission.json', {'state': 'accepted', 'id': job.get('id')})
        print('Resume command: python3 scripts/generate_animations.py resume %s' % (folder / 'job.json'), flush=True)
        if not job.get('id'):
            raise VideoError('Response has no job ID; inspect the saved response before resubmitting.')
        finish_job(client, job, folder, args.timeout)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nStopped locally. A submitted job may still run; use its saved job.json to resume.', file=sys.stderr)
        sys.exit(130)
    except (VideoError, ValueError, KeyError, OSError) as exc:
        print('Error: ' + redact(exc), file=sys.stderr)
        sys.exit(1)
