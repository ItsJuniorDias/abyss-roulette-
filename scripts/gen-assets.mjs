// Generates the game art via OpenRouter + Nano Banana (Gemini 2.5 Flash Image).
//
//   cp .env.example .env   # add your OPENROUTER_API_KEY
//   npm run gen:assets              -> generates every asset that doesn't exist yet
//   npm run gen:assets -- --force   -> regenerates all of them
//   npm run gen:assets -- emblem    -> generates only the "emblem" asset
//
// Images go to public/assets/*.png, plus a compressed *.webp when cwebp is on PATH.
// The game loads the WebP first and falls back to the PNG.
// If a file is missing, the game falls back to its procedural (canvas) version.

import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');

const STYLE =
  'Art style: Mike Mignola-inspired comic art. Extremely heavy solid black shadows (chiaroscuro), ' +
  'flat unshaded color fields, bold brush-ink linework, angular gothic shapes, limited palette of ' +
  'blood crimson (#b3191c), mustard ochre (#d9a23a), muted teal (#2b6b60), bone white (#efe3c4) and pure black. ' +
  'Pulp occult mood. No text, no letters, no watermark, no signature, no characters from existing franchises.';

const ASSETS = {
  background: {
    aspect: '16:9',
    prompt:
      'Wide establishing shot of an ancient gothic crypt interior at night seen straight on. ' +
      'Massive flat blood-red full moon disc in the center top, framed by black stone arches and pillars in silhouette. ' +
      'Hanging chains, candles with tiny ochre flames, a few skulls in niches. The center bottom third is empty dark ' +
      'floor (a roulette wheel will be placed there). ' + STYLE,
  },
  emblem: {
    aspect: '1:1',
    prompt:
      'A perfectly circular occult sigil medallion seen flat from the front, centered on a pure black background. ' +
      'Concentric rings of strange rune-like glyphs (invented, not real letters), a stylized horned skull at the center, ' +
      'thick black ink outlines, crimson and ochre flat fills. Symmetric, graphic, iconic. ' + STYLE,
  },
  felt: {
    aspect: '1:1',
    prompt:
      'Seamless tileable texture of worn dark crimson velvet cloth with subtle hand-inked crosshatching ' +
      'and a faint ochre gothic damask pattern. Flat top-down view, even lighting, no perspective. ' + STYLE,
  },
  wood: {
    aspect: '1:1',
    prompt:
      'Seamless tileable texture of dark carved ebony wood with oxblood red lacquer, drawn as comic art: ' +
      'bold black ink grain lines, flat color, minimal gradients. Flat top-down view. ' + STYLE,
  },
};

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function generate(name, { prompt, aspect }) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'Abyss Roulette',
    },
    body: JSON.stringify({
      model: MODEL,
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: aspect },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error(`no image in response: ${JSON.stringify(data).slice(0, 400)}`);

  const b64 = url.replace(/^data:image\/\w+;base64,/, '');
  const file = join(OUT_DIR, `${name}.png`);
  await writeFile(file, Buffer.from(b64, 'base64'));
  // ~10x smaller for the same look; skipped quietly when cwebp isn't installed
  spawnSync('cwebp', ['-quiet', '-q', '82', '-m', '6', file, '-o', file.replace(/\.png$/, '.webp')]);
  return file;
}

async function main() {
  if (!API_KEY) {
    console.error('Set OPENROUTER_API_KEY in .env (see .env.example).');
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.filter((a) => !a.startsWith('--'));
  const names = only.length ? only : Object.keys(ASSETS);

  await mkdir(OUT_DIR, { recursive: true });

  for (const name of names) {
    const def = ASSETS[name];
    if (!def) { console.warn(`? unknown asset: ${name}`); continue; }
    const file = join(OUT_DIR, `${name}.png`);
    if (!force && ((await exists(file)) || (await exists(file.replace(/\.png$/, '.webp'))))) { console.log(`= ${name} (already exists)`); continue; }
    process.stdout.write(`… ${name} `);
    try {
      await generate(name, def);
      console.log('ok');
    } catch (err) {
      console.log('failed');
      console.error(`  ${err.message}`);
    }
  }
}

main();
