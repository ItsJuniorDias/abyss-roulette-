# Verification

Run `npm run verify` for the complete local check. It is offline except for initial dependency installation and does not generate media or contact a betting service.

- 31 colocated TypeScript tests cover the European wheel, payouts, request validation, idempotency, integer overflow, input locking, duplicate/stale acknowledgements, recovery, undo/rebet, persistence and ball endpoints.
- 24 Node regression tests exercise the actual TypeScript audio and mascot providers with browser doubles: retained frames, same-state loops, fades, rapid state changes, rejected/opaque frames, Safari fallback, visibility, autoplay and disposal.
- `assets:check` validates 37 runtime files and the audio/video manifests.

## Browser checklist

Start the development server or build and start preview. Use portrait 390 × 844 and a normal desktop viewport. Only demo credits are involved.

1. Wait for `#game-shell[data-ready="true"]`. Check that the wheel appears and `.mascot-stage` reaches `data-transition="steady"` without interaction. There should be one `#lounge-music` element and two mascot video decoders.
2. Place a 5-credit red bet. Confirm stake 5 and balance reduced by 5. Spin; check controls are locked during `requesting`, `spin` and `result`.
3. Observe `spin → result → bet`, a new history entry and the corresponding mascot transition. Verify the resulting balance using the bet rules, rather than canvas pixels.
4. Repeat the last bet from the menu, undo it, and confirm the original balance and empty stake. Toggle sound off/on and close the menu.
5. Open the full table, select zero, then close with Escape. Confirm focus returns to the opener and the stake is preserved.
6. Start that round and reload during `spin`. The accepted pending round should resume, without another deduction or additional result. After settlement, reloading again must not replay or credit it twice.
7. Check the browser console, page overflow and full-table scrolling. Inspect the portrait composition and alpha edges in motion. Repeat on physical iPhone Safari and Chrome for WebKit/HEVC validation.

## Refactor validation — 2026-10-07

`npm run verify` passed: 55 tests, 37 runtime assets, TypeScript, lint, formatting and production build. Browser checks in the Codex Chromium browser passed for startup, complete rounds, menu repeat/undo, sound toggle, full-table zero bet, Escape/focus restoration and reload during a round. Both the development app and production build ran without warning/error console entries in those checks. Portrait layout was inspected at 390 × 844.

Physical iPhone validation is still manual; desktop viewport emulation does not establish HEVC behavior on iOS. The remote RGS contract is not implemented: this build uses the local demo adapter.
