#!/usr/bin/env python3
"""Prepare local AI outputs for the mobile game. No provider API calls."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
import subprocess
from generate_animations import ROOT, alpha_report, probe

DEST = ROOT / 'public/animations/ai/mascot-v1'
KEY = 'format=yuva444p,chromakey=0x00ff00:0.16:0.06,format=rgba,despill=type=green:mix=1,scale=640:480:flags=lanczos'

def run(args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y'] + args, check=True)

def publish(name):
    folders = sorted((ROOT / 'output/ai-video' / name).glob('*/exports.json'))
    if not folders:
        raise RuntimeError('No completed export for ' + name)
    folder = folders[-1].parent
    job = json.loads((folder / 'job.json').read_text())
    if job.get('status') != 'completed':
        raise RuntimeError('Job is not complete: ' + str(folder))
    source = folder / 'source.mp4'
    webm, mov = DEST / (name + '.webm'), DEST / (name + '.mov')
    run(['-i', str(source), '-vf', KEY, '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
         '-b:v', '0', '-crf', '29', '-auto-alt-ref', '0', '-row-mt', '1', str(webm)])
    run(['-i', str(source), '-vf', KEY + ',format=bgra', '-an', '-c:v', 'hevc_videotoolbox',
         '-allow_sw', '1', '-alpha_quality', '.85', '-b:v', '900k', '-tag:v', 'hvc1',
         '-movflags', '+faststart', str(mov)])
    duration = float(probe(webm)['format']['duration'])
    report = alpha_report(webm, duration)
    if not report['passed']:
        raise RuntimeError('Alpha validation failed: ' + name)
    for path in (webm, mov):
        assert not any(s['codec_type'] == 'audio' for s in probe(path)['streams'])
    if name == 'welcome':
        run(['-ss', '0.1', '-i', str(source), '-vf', KEY, '-frames:v', '1', str(DEST / 'poster.png')])
    print(name + ' ready', flush=True)
    return name, {'duration': duration, 'size': [640, 480], 'source': str(folder.relative_to(ROOT)),
                  'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                  'webm_bytes': webm.stat().st_size, 'hevc_bytes': mov.stat().st_size,
                  'alpha': report, 'audio': False}

if __name__ == '__main__':
    DEST.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        clips = dict(pool.map(publish, ['welcome', 'idle', 'spin', 'win', 'loss']))
    (DEST / 'manifest.json').write_text(json.dumps({'version': 1, 'framing': 'waist-up', 'clips': clips}, indent=2) + '\n')
