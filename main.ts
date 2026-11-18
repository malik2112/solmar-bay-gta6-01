// SOLMAR BAY — the entrypoint that hands the game in (Node 22, stdlib only).
// It copies this directory's game/ and screenshots/ to /output and writes
// /output/dossier.json with the kit's vendored make.fun library, so the judge
// reads exactly what the player plays. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files in all, or a path under game/ over 1000 bytes.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// SOLMAR BAY's own guard: never hand in an entry with no screenshots — the
// cover is the first thing the judge sees, and the kit refuses an empty set.
const shots = readdirSync(join(out, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (shots.length < 3) throw new Error(`SOLMAR BAY: only ${shots.length} screenshot(s) in screenshots/ — need 3 or 4`);
for (const f of shots) {
  const bytes = statSync(join(out, 'screenshots', f)).size;
  if (bytes > 262144) throw new Error(`SOLMAR BAY: screenshot ${f} is ${bytes} bytes — over the 256 KiB cap`);
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`SOLMAR BAY dossier: ${dossier.length} bytes, ${shots.length} screenshots (${shots.join(', ')})`);
