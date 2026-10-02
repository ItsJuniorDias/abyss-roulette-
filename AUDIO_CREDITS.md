# Audio credits and provenance

Every audio file shipped in `public/audio/` comes from Pixabay and is used under the
[Pixabay Content License](https://pixabay.com/service/license-summary/). The license allows commercial
use inside a game and doesn't require attribution, so the credits below are a courtesy and a provenance record.
`scripts/prepare-audio.mjs` processes the raw downloads, which live in `audio-src/` (gitignored), into the shipped files.

| Game file | Pixabay item | Author | Notes |
|---|---|---|---|
| `music_main_a` | [Dark Cinematic Drone Deep Bass Ambient](https://pixabay.com/music/ambient-dark-cinematic-drone-deep-bass-ambient-456038/) | nxtlvl_snds | music playlist, no Content ID |
| `music_main_b` | [Religious Mystery – Dark Day Precedes The Light](https://pixabay.com/music/ambient-religious-mystery-dark-day-precedes-the-light-456523/) | DPatterson_Composer | music playlist, no Content ID |
| `sfx_wheel_spin_start` | [Spinning roulette wheel](https://pixabay.com/sound-effects/film-special-effects-spinning-roulette-wheel-429832/) | spinopel | first 3.6 s |
| `sfx_ball_roll_loop`, `sfx_ball_deflector`, `sfx_ball_hit_b`, `sfx_ball_settle` | [roulette_casino_evian.aif](https://pixabay.com/sound-effects/film-special-effects-roulette-casino-evianaif-14446/) | f_ilippo via freesound_community ⚠️ | real casino recording, cut into 4 segments |
| `sfx_ball_hit_a` | [Ball in hole](https://pixabay.com/sound-effects/film-special-effects-ball-in-hole-99750/) | NeatoEnt via freesound_community ⚠️ | first hit only |
| `sfx_chip_place` | [Placing poker chips](https://pixabay.com/sound-effects/film-special-effects-placing-poker-chips-522523/) | OxidVideos | |
| `sfx_chip_stack_clear` | [AllInPushChips](https://pixabay.com/sound-effects/film-special-effects-allinpushchips-96121/) | joeyed via freesound_community ⚠️ | |
| `sfx_ui_click` | [Menu Button (Stone)](https://pixabay.com/sound-effects/film-special-effects-menu-button-stone-41289/) | Bratish via freesound_community ⚠️ | |
| `sfx_win_hit` | [Single Church Bell 2](https://pixabay.com/sound-effects/film-special-effects-single-church-bell-2-352062/) | Universfield | |
| `sfx_bigwin_impact` | [Dry Thunder](https://pixabay.com/sound-effects/nature-dry-thunder-443132/) | DRAGON-STUDIO | |
| `sfx_lose_thud` | [Impact Thud](https://pixabay.com/sound-effects/film-special-effects-impact-thud-291047/) | Universfield | |
| `sfx_ember_whoosh` | [Fireball Whoosh 1](https://pixabay.com/sound-effects/film-special-effects-fireball-whoosh-1-179125/) | floraphonic | |
| `amb_crypt_loop` | [Dungeon Air](https://pixabay.com/sound-effects/film-special-effects-dungeon-air-6983/) | Flamiffer via freesound_community ⚠️ | 30 s seamless loop |
| `amb_candle_fire_loop` | [Fireplace Fire Crackling – Loop](https://pixabay.com/sound-effects/nature-fireplace-fire-crackling-loop-123930/) | SoundsForYou | 30 s seamless loop |

## Optional cues (not downloaded yet)

`prepare-audio.mjs` already handles these. Download them into `audio-src/`, then run `npm run audio:prepare`.

| Game file | Pixabay item | Author |
|---|---|---|
| `music_spin_tension` | [Short percussive orchestral tension v.02](https://pixabay.com/sound-effects/musical-short-percussive-orchestral-tension-v02-481586/) | Montogoronto |
| `music_win_jingle` | [choir singing major chord](https://pixabay.com/sound-effects/musical-choir-singing-major-chord-442713/) | flutie8211 |
| `music_bigwin_stinger` | [Colossal Bell Stinger – Dark Fantasy Rune Lock](https://pixabay.com/sound-effects/film-special-effects-colossal-bell-stinger-dark-fantasy-rune-lock-591739/) | Coghezzi |

## Compliance notes

- **Do not ship** "Hidden Ritual (Dark Ambient Suspense)" by AlexGrohl (Pixabay 465795). It is registered with YouTube Content ID. It may sit in `audio-src/` but is excluded from `prepare-audio.mjs`.
- ⚠️ **freesound_community**: Pixabay re-hosts these files from Freesound and doesn't document their original license. For a real-money product, check each original on freesound.org (most are CC0) or replace it with a file from a named Pixabay author.
- The Pixabay license doesn't mention gambling. It does prohibit use that breaches any "law, regulation or industry code", so the product must operate legally in each market where it runs.
- Pixabay's license summary and terms (last updated November 18, 2024) were checked on 2026-10-02.
