# Aurum Club audio credits

The user downloaded these seven Pixabay assets on October 6, 2026. Their source
pages identify the [Pixabay Content License](https://pixabay.com/service/license-summary/).
Original downloads remain in `audio-src/` (gitignored). Processed files, source URLs,
authors, durations and SHA-256 hashes are recorded in `public/audio/manifest.json`.
The selection is saved in `design-system/audio-selection.json`.

| Runtime slot | Source | Author |
|---|---|---|
| `music_lounge` | [Luxury Jazz Lounge Background Music](https://pixabay.com/music/traditional-jazz-luxury-jazz-lounge-background-music-464517/) | Top-Flow |
| `sfx_chip_place` | [Placing poker chips](https://pixabay.com/sound-effects/film-special-effects-placing-poker-chips-522521/) | OxidVideos |
| `sfx_chip_stack_clear` | [AllInPushChips](https://pixabay.com/sound-effects/film-special-effects-allinpushchips-96121/) | joeyed via freesound_community |
| `sfx_wheel_spin_start` | [Spinning roulette wheel](https://pixabay.com/sound-effects/film-special-effects-spinning-roulette-wheel-429832/) | spinopel |
| `sfx_ball_roll_loop`, `sfx_ball_deflector`, `sfx_ball_hit_a`, `sfx_ball_hit_b`, `sfx_ball_settle` | [A roulette ball](https://pixabay.com/sound-effects/film-special-effects-a-roulette-ball-429831/) | spinopel |
| `sfx_ui_click` | [Soft Interface Click](https://pixabay.com/sound-effects/film-special-effects-soft-interface-click-126517/) | Universfield |
| `sfx_win_fanfare` | [Brass Fanfare](https://pixabay.com/sound-effects/film-special-effects-brass-fanfare-144755/) | Universfield |

Top-Flow's source page marks the music as AI generated and Content ID registered.
Keep the download/license record with the original file. This provenance record
does not claim that a license certificate was downloaded or a Content ID claim cleared.

## Preparation and playback

```sh
npm run audio:prepare
npm run build
```

The preparation script requires FFmpeg and all seven original MP3s with their
Pixabay IDs in the filenames. It preserves the previous runtime set when a source
is missing and removes only obsolete generated files listed in the prior manifest.
Original downloads are preserved.

- Music: 128 kbps stereo MP3, loudness normalized, 2-second end-to-start crossfade.
- Rolling: a short loop with crossfade and padding for Web Audio loop boundaries.
- Contacts: short segments from the same roulette-ball recording, varied in pitch.
- Fanfare: complete cue with gain adjusted for regular and large wins.
- Loss: short synthesized note. Unavailable effects retain synthesized fallbacks.

The game streams music after the first user gesture and decodes only short effects
into Web Audio buffers. Music ducks during spins and victories. Mute persists;
backgrounding pauses both the media element and AudioContext.

The old dark soundtrack and ambience exports are no longer shipped.
