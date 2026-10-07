# Aurum Club

Mobile portrait European roulette with a luxury lounge, a Three.js wheel, an animated lion host and Web Audio. The interface is React; all game code is strict TypeScript. The game uses **demo credits only**.

## Run and verify

Use Node **22.18+ (22.x), 24+ (24.x), or 26+**. The project is tested on Node 24.

```bash
npm ci
npm run dev

npm run verify
npm run preview -- --host 0.0.0.0
```

`verify` runs lint, formatting checks, unit and media regression tests, asset validation, type checking and a production build. `build` writes to `dist/`. Vite prints the local URL; the development default is port 5173 and preview is 4173.

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Strict TypeScript, without emitting JavaScript |
| `npm run lint` | TypeScript and React hook rules |
| `npm run test:unit` | Colocated Vitest tests for rules, credits, recovery and ball motion |
| `npm run test:regression` | Media decoder/canvas and audio lifecycle regressions |
| `npm run assets:check` | Runtime files, checksums and video manifest consistency |
| `npm run format` | Format TypeScript and configuration |
| `npm run audio:prepare` | Prepare downloaded audio with FFmpeg |

## Architecture

The refactor follows the supplied app architecture, adapted to this standalone Three.js game. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) records the responsibilities, round contract and integration boundary.

```text
src/
  app/            bootstrap, dependency construction, React entry
  components/     app, scene manager, HUD, mascot, wheel, betting controls
  scenes/         gameplay composition
  hooks/          input, ticker, presentation and resource lifecycles
  stores/         Zustand session state and round checkpoints
  providers/      disposable Three.js, video/canvas and audio resources
  adapters/       local demo outcome port and versioned browser storage
  animations/     pure ball and chip calculations
  config/         rules, layout, palette, timings and asset aliases
  interfaces/     component props and session/resource contracts
  types/          unions and browser declarations
  utils/          validation, credits, formatting and translation
assets/locales/   English message dictionary
public/           served artwork, fonts, audio and alpha video clips
tests/support/   media test doubles and regression harnesses
scripts/          asset generation, processing and validation
```

The UI asks the session to play. The demo adapter supplies a validated outcome. Three.js only presents that outcome, then acknowledges the round ID. Duplicate or obsolete acknowledgements cannot settle another round. Accepted pending rounds are saved and restored before replaying their presentation. Unsubmitted chip selections are refunded when the page reloads. Existing Aurum/Abyss demo saves are migrated.

`VITE_SESSION_PROFILE=demo` is the only supported profile. No RGS or workspace-private packages are bundled. A production integration needs server-authoritative play, settlement and recovery; replacing the demo random-number function alone is insufficient. Amounts here are integer **play credits**, with no currency conversion.

## Controls and presentation

Tap a chip, select bets, then spin. The full table and menu open as focus-trapped bottom sheets. The menu provides undo, repeat and sound controls. Keyboard shortcuts outside focused controls: 1–4 select chips, Space spins, Z/Backspace undo, R repeats, C clears and M toggles sound. Right-click or Delete/Backspace on a bet removes that selection.

The lion starts automatically with muted video. Two persistent decoders feed one visible canvas. Repeated idle/spin animations loop natively; changes retain a decoded frame and blend for 300 ms. Each output frame is cleared before drawing, preserving the iPhone trail fix. HEVC alpha and VP9 alpha exports remain available. Reduced motion and page visibility are respected.

Audio starts after a browser-accepted user gesture. One music element streams through Web Audio; only short effects are decoded. Mute persists, backgrounding pauses playback, and missing effects use synthesis. The session owns and disposes its listeners, timers and audio context. Physical iPhone Safari/Chrome should be checked after changes to decoding or compositing.

## Assets and tooling

Current runtime assets live in `public/`; stable aliases are in `src/config/assets.ts`. The original design exports remain in `design-system/`. Heavy editing masters, raw audio, local outputs and credentials stay ignored. The existing Python 3 animation pipeline is retained:

```bash
python3 scripts/generate_animations.py --help
```

Generation commands may contact paid providers and require local credentials; verification does not generate or purchase media. Never place secrets in `VITE_*` variables, which are public client configuration. See [.env.example](.env.example), [AUDIO_CREDITS.md](AUDIO_CREDITS.md) and the existing design-system documents for asset provenance and production steps.

Code: [MIT](LICENSE). Audio and art retain their respective source terms.
