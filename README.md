# Abyss Roulette

A 3D European roulette game in the browser, drawn like a Mike Mignola comic: hard toon shading, ink outlines, deep black shadows, crimson, ochre and teal colors, candles, skulls and drifting embers.

![Abyss Roulette: the inked roulette wheel above the betting table](docs/screenshot.jpg)

> **Prototype with demo credits.** It uses no real money. See [Production notes](#production-notes) before you build anything real on top of it.

## Features

- **European single-zero wheel** with the real 37-pocket order, colors and payouts
- **Physically plausible ball path**: the ball launches, rides the track, clips a deflector, bounces across the frets and settles. It always lands on the pre-drawn result, so a server can decide the outcome.
- **Unbiased RNG**: `crypto.getRandomValues` with rejection sampling, so there is no modulo bias
- **Toon look built in code**: a 3-step gradient map, inverted-hull ink outlines and hand-hatched canvas textures for the wheel and sigil
- **Generated art (optional)**: a backdrop, sigil, felt and wood textures made with Gemini 2.5 Flash Image through OpenRouter. Every image has a procedural fallback.
- **Layered audio mix**: music, ambience and SFX buses go through a compressor. The music playlist crossfades, the ambience loops seamlessly, and the ball-roll sound follows the ball's speed. Every sample has a synthesized fallback.
- **Comic result FX**: a "KRA-THOOM!" banner, screen shake, a red flash and an ember burst on wins

## Controls

| Action | Input |
|---|---|
| Pick a chip value | Click a chip (1 · 5 · 25 · 100) |
| Place a bet | Click a cell on the table |
| Remove a bet | Right-click the cell |
| Spin | **SPIN** button or <kbd>Space</kbd> |
| Repeat the last round's bets | **REBET** |
| Clear all bets | **CLEAR** |
| Mute or unmute | **SOUND** button or <kbd>M</kbd> (the choice is remembered) |

### Bets and payouts

| Bet | Pays |
|---|---|
| Straight number (0–36) | 35:1 |
| Dozen (1st / 2nd / 3rd 12) | 2:1 |
| Column (2:1) | 2:1 |
| Red / Black · Even / Odd · 1–18 / 19–36 | 1:1 |

Zero loses every outside bet.

## Quick start

You need **Node 22.9+**.

```bash
npm install
npm run dev
```

Then open the URL that Vite prints. Click once or press a key to start the audio, because browsers block sound until a user gesture.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server with hot reload |
| `npm run build` | Builds the production bundle into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run gen:assets` | Generates the missing art with OpenRouter |
| `npm run audio:prepare` | Turns the raw audio downloads into game-ready files (needs `ffmpeg`) |

## Generated art

`scripts/gen-assets.mjs` sends a prompt to `google/gemini-2.5-flash-image` through OpenRouter and saves each image as a PNG in `public/assets/`.

| Asset | Used for |
|---|---|
| `background.png` | Full-screen backdrop behind the 3D scene |
| `emblem.png` | Rune sigil under the wheel |
| `felt.png` | Table cloth texture |
| `wood.png` | Wheel bowl texture |

```bash
cp .env.example .env              # add your OPENROUTER_API_KEY
npm run gen:assets                # generate only the missing assets
npm run gen:assets -- --force     # regenerate all of them
npm run gen:assets -- emblem      # generate a single asset
```

Every asset is optional. If a file is missing, the game draws a procedural version instead.

## Audio

All sounds come from Pixabay. [AUDIO_CREDITS.md](AUDIO_CREDITS.md) lists the sources, authors and license notes.

Put the raw Pixabay downloads in `audio-src/` (gitignored) and keep the Pixabay id in each file name. Then run:

```bash
npm run audio:prepare
```

The script cuts and trims each clip, normalizes its loudness, builds seamless loops and writes `public/audio/manifest.json`. The game reads that manifest after the first user gesture. A sound that is missing falls back to a synthesized version.

## How the spin works

The client receives a pocket index and animates the ball to it. The physics never decides the result.

- The ball's angle `psi` is measured **relative to the rotor**, and pocket `i` sits at `psi = i · SEG`.
- During the spin, `psi` eases from `target + A` to `target`, where `A` adds several full turns. The ball therefore always comes to rest in the drawn pocket.
- The spin runs on wall-clock time, so a slow frame doesn't change the outcome or the length of the round.

In production, the server sends the index and `startSpin()` only animates it.

## Project structure

```
src/
  main.js     ball path, betting and payouts, UI, camera, game loop
  scene.js    renderer, lights, toon materials, wheel, props, particles
  rules.js    wheel order, bet table, secure RNG
  audio.js    audio engine: buses, music playlist, loops, SFX, synth fallbacks, mute
  style.css   comic-panel UI
scripts/
  gen-assets.mjs     AI art generation (OpenRouter)
  prepare-audio.mjs  ffmpeg audio pipeline
public/
  assets/     generated images (optional)
  audio/      prepared audio and manifest.json
```

**Stack:** [Three.js](https://threejs.org/) · [Vite](https://vite.dev/) · Web Audio API. There is no framework.

## Roadmap

- [ ] Ball spins against the rotor, as on a real wheel. Today it travels in the same direction as the rotor, only faster.
- [ ] Rebuy when the balance hits zero, and keep the balance between sessions
- [ ] Tap to remove a single bet on touch screens
- [ ] Inside bets: split, street, corner, six line, 0-1-2-3
- [ ] Table limits and undo for the last chip
- [ ] Better mobile layout for the HUD, the betting table and the history
- [ ] Keyboard betting, `aria-live` result announcements, `prefers-reduced-motion`
- [ ] Ship WebP images instead of the current ~5 MB of PNGs

## Production notes

This demo is not built for real-money play.

- **The outcome must come from the server**, drawn by a certified RNG. The client draws it here only for the demo.
- **The server must own balances and payouts.** Today the client tracks both.
- Before a commercial release, check the original license of every `freesound_community` sound. [AUDIO_CREDITS.md](AUDIO_CREDITS.md) has the details.
- Gambling is regulated by market. Make sure the product runs legally wherever it is offered.

## License

Code: [MIT](LICENSE) © 2026 Alexandre Junior. Audio and generated art follow the terms in [AUDIO_CREDITS.md](AUDIO_CREDITS.md) and the [Generated art](#generated-art) section.
