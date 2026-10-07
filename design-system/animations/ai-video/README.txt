Aurum Club — AI video generation (Python 3.9+)

Provider: OpenRouter. Model: heygen/heygen-video-1.
Requirements: Python 3, ffmpeg, ffprobe. No pip packages required.

1. Add OPENROUTER_API_KEY to the project .env file (copy .env.example if needed).
   Never put the key in VITE_* or in client-side code. Obtain a key in your
   OpenRouter account and keep it private. API generation consumes credits.
2. Keep the public tunnel/asset server running. The model needs to fetch the
   first-frame image via HTTPS. The script uses tmp/tunnel/active.json, or
   OPENROUTER_ASSET_BASE_URL, or an explicit --reference-url.
3. Preview the requests without starting paid jobs:
     python3 scripts/generate_animations.py plan all
4. Generate one pilot, then inspect its result:
     python3 scripts/generate_animations.py generate welcome
5. Generate the complete set (including a new welcome):
     python3 scripts/generate_animations.py generate all
   Individual names: welcome, idle, spin, win, loss.
   Each command submits NEW paid jobs. Do not repeat generate to resume.

Outputs: output/ai-video/<animation>/<timestamp>/
  source.mp4       original provider video (green background, includes audio)
  transparent.webm VP9 video with alpha, suitable for compatible browsers
  master.mov       ProRes 4444 editing master with alpha
  preview.mp4      opaque dark-green review background
  job.json         saved remote job ID and polling status
  request.json     exact submitted request, without API credentials
  alpha-report.json / exports.json

Resume without submitting another paid job:
  python3 scripts/generate_animations.py resume output/ai-video/NAME/TIMESTAMP/job.json
If a submission failed before returning its ID, check OpenRouter Activity before
submitting again. POST requests are not automatically retried.

Reprocess a downloaded green-screen video without making API calls:
  python3 scripts/generate_animations.py process path/to/source.mp4 --out output/review
  Optional: --similarity 0.16 --blend 0.06

Approved layout: portrait mobile game, waist-up lion next to the board.
The character asset uses a 4:3 canvas for hand/shoulder margins; the GAME remains
portrait. Every state uses the same green first frame, identity constraints,
camera, warm lighting, jewelry, chip hand, face scale and waist anchor.
The first frame is prepared once with the built-in image tool from the approved
lion reference. Its source and prompt are saved in this project.

Transparency is produced by local chroma key, not native model alpha. Review fur,
hands, chip, color spill, identity and all transitions before publishing. The alpha
check samples decoded pixels, not artistic quality. Loop continuity is requested
in the prompt and must be verified; it is not guaranteed by the model. Generation saves source and editing exports. Publish the completed set explicitly
with the local command below. All five states have now completed generation and
are integrated into the approved production layout.

HeyGen always renders an audio track and rejects generate_audio=false with HTTP
400. The request enables audio; FFmpeg removes it from transparent.webm,
master.mov and preview.mp4. Only source.mp4 retains the provider audio.

Official API references:
https://openrouter.ai/docs/guides/overview/multimodal/video-generation
https://openrouter.ai/docs/cookbook/video-generation/image-to-video
https://openrouter.ai/heygen/heygen-video-1

Publish the latest completed set to the mobile game (no API calls or credits):
  python3 scripts/publish_animations.py
  npm run build

Runtime files: public/animations/ai/mascot-v1/
  welcome, idle, spin, win, loss: VP9 WebM alpha + HEVC MOV alpha
  poster.png: transparent fallback from the same welcome video
  manifest.json: source hashes, dimensions, durations, sizes and alpha checks

The publishing script uses FFmpeg's macOS hevc_videotoolbox encoder for HEVC
alpha. It prepares 640x480 silent clips from the original green-screen videos.
Green despill uses mix=1 to preserve the gold mane and cream wardrobe.
Editing masters remain in output/ai-video and are not overwritten by publishing.

The game selects a decodable alpha format, verifies a transparent corner and
falls back to the poster if neither codec works. Welcome/win/loss return to idle
on the video's ended event. Idle and spin loop. Reduced-motion preference uses
the still poster. VP9 playback and transparency have been checked in the desktop
browser; HEVC output still needs validation on a physical iPhone.
