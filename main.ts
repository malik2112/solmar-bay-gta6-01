// SOLMAR BAY — entry program (Node 22, no build step).
// Copies game/ and screenshots/ from this repo into the output directory and
// writes the makefun/dossier/v1 dossier there with the kit's own library.
//
//   MAKEFUN_OUTPUT_DIR=/tmp/solmar-out2 node main.ts

import { cpSync, mkdirSync, rmSync, statSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || join(here, 'out');

// Every dossier needs its screenshots up front: refuse early with a clear
// message instead of letting the kit library fail on an empty folder.
const shotFiles = readdirSync(join(here, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`screenshots/ holds ${shotFiles.length} images, need 3 or 4`);
}
for (const f of shotFiles) {
  const bytes = statSync(join(here, 'screenshots', f)).size;
  if (bytes > 262144) throw new Error(`screenshots/${f} is ${bytes} bytes, over the 256 KiB cap`);
}

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

// A small build manifest next to the dossier: what went in, when, how big.
const gameFiles = [];
(function walk(dir, rel) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(join(dir, entry.name), p);
    else gameFiles.push({ path: p, bytes: statSync(join(dir, entry.name)).size });
  }
})(join(here, 'game'), '');
const manifest = {
  game: 'SOLMAR BAY',
  competition: 'gta6-01',
  builtAt: new Date().toISOString(),
  dossierBytes: dossier.length,
  gameFiles: gameFiles.length,
  gameBytes: gameFiles.reduce((n, f) => n + f.bytes, 0),
  screenshots: shotFiles.map((f) => ({ file: f, bytes: statSync(join(here, 'screenshots', f)).size })),
};
writeFileSync(join(outDir, 'build-info.json'), JSON.stringify(manifest, null, 2) + '\n');

const gameBytes = statSync(join(outDir, 'game')).size;
console.log(`SOLMAR BAY dossier written: ${outDir}/dossier.json (${dossier.length} bytes)`);
console.log(`game/ + screenshots/ copied to ${outDir} (game dir entry: ${gameBytes})`);
console.log(`build manifest: ${gameFiles.length} game files, ${manifest.gameBytes} bytes, ${shotFiles.length} screenshots`);
