// SOLMAR BAY — entry program (Node 22, no build step).
// Copies game/ and screenshots/ from this repo into the output directory and
// writes the makefun/dossier/v1 dossier there with the kit's own library.
//
//   MAKEFUN_OUTPUT_DIR=/tmp/solmar-out2 node main.ts

import { cpSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || join(here, 'out');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});

if (dossier.length > 1572864) {
  throw new Error(`dossier.json is ${dossier.length} bytes, over the 1.5 MiB gate`);
}
writeFileSync(join(outDir, 'dossier.json'), dossier);

const gameBytes = statSync(join(outDir, 'game')).size;
console.log(`SOLMAR BAY dossier written: ${outDir}/dossier.json (${dossier.length} bytes)`);
console.log(`game/ + screenshots/ copied to ${outDir} (game dir entry: ${gameBytes})`);
