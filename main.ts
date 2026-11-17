// PALMA HEAT — a working gta6-01 entry (Node 22, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, three.js vendored under game/vendor/, no network
// request), and the program hands it in. It copies game/ and screenshots/ from beside this
// file to /output and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library. The game itself is PALMA HEAT: an original 3D open-world crime
// game in the fictional bay city of Bahía Palma — a deterministic road-grid city, traffic and
// pedestrian AI, a 0–5-star wanted/police system, pistol + melee combat, Carmen Vega's
// 3-mission story chain (First Run, Marina Muscle, Palma Trust), package pickups, checkpoint
// street races, a full HUD with minimap, localStorage saves, and WebAudio-synthesised sound.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

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

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
// PALMA HEAT improvement: a one-line validation log of what was actually copied, so a
// handover run proves at a glance that game/ and screenshots/ arrived complete in /output.
function countCopied(dir: string): { files: number; bytes: number } {
  let files = 0, bytes = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name), s = statSync(p);
    if (s.isDirectory()) { const sub = countCopied(p); files += sub.files; bytes += sub.bytes; }
    else { files++; bytes += s.size; }
  }
  return { files, bytes };
}
const copiedGame = countCopied(join(out, 'game'));
const copiedShots = countCopied(join(out, 'screenshots'));
console.log(`PALMA HEAT handover: game/ = ${copiedGame.files} files, ${copiedGame.bytes} bytes; screenshots/ = ${copiedShots.files} files, ${copiedShots.bytes} bytes -> ${out}`);

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
