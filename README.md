# SOLMAR BAY — Make GTA 6 (make.fun gta6-01)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/malik2112/solmar-bay-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/malik2112/solmar-bay-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A complete open-world crime game that runs offline in a desktop browser from
static files. Built from scratch with Three.js (vendored under `game/vendor/`).

## Play

```sh
node serve.ts        # then open http://127.0.0.1:8901/game/index.html
```

Or open `game/index.html` directly from any static file server. `serve.ts`
also answers `GET /health` with `{"ok": true, ...}` for monitors and the
screenshot driver.

## The game

You are Vic, fresh out of the marina lockup with $120 and a borrowed pistol.
Mara and Dario have five jobs for you across Solmar Bay, a sun-soaked coastal
city: steal cars, run beachfront pickups, dodge the Solmar Bay PD, and bring
the final gold coupe home.

- **City** — a 9×9 road grid with procedural towers (canvas facade textures),
  beachfront, ocean, palms, streetlights, billboards and a sweeping
  lighthouse beam; drifting clouds and a breathing ocean
- **Driving** — steal any parked car (E), arcade handling, handbrake, traffic
  that follows the road grid and turns at intersections, car horn (H)
- **On foot** — third-person walking and sprinting with a stamina meter,
  mouse-look camera, gamepad left stick supported
- **Combat** — hitscan pistol with tracers and muzzle flash, reload, ammo
  reserve, distance damage falloff
- **Wanted** — 0–5 star heat, police cruisers that chase and ram, busted/wasted
  with respawn fines
- **Missions** — 5 story jobs with a pulsing beacon marker, HUD tracking and
  cash rewards, plus a $2,000 story bonus for finishing all five
- **HUD** — health / stamina / ammo bars, wanted stars, cash, in-game clock,
  speed + gear + radio, live minimap (player, traffic, police, peds, marker)
- **Sound** — synthesized WebAudio: engine hum, four radio stations, sirens,
  horn, skid and pickup chimes
- **Save** — progress autosaves to localStorage every 12 s; continue from the
  menu; portable export/import via `exportSave` / `importSave`

## Controls

WASD move / drive · Shift sprint (stamina) · E enter/exit car · Mouse aim,
Click shoot · R reload · Q radio · H horn · Space handbrake · P pause ·
M mute · Gamepad left stick to move/drive

## Self test & screenshots

- `?selftest=1` runs the in-browser self test and reports PASS/FAIL in the
  page title and an on-screen panel (city, traffic, peds, missions, wanted
  math, reload, stamina, radio, marker).
- `?shot=drive|street|mission|start` stages a composed scene for screenshots
  (see `shots.json`); the page sets `window.__solmarReady` on boot and
  `window.__shotReady` once the scene has settled. `?shot=chase` stages a
  two-star beachfront chase (extra preset, not in the dossier set).
- Regenerate the four dossier screenshots with the Playwright driver:
  `node ../shot-driver.mjs` (chrome-headless-shell + SwiftShader).

## Build the dossier

```sh
MAKEFUN_OUTPUT_DIR=/tmp/solmar-out3 node main.ts
```

This validates the screenshots, copies `game/` and `screenshots/` to the
output directory, writes `dossier.json` (makefun/dossier/v1) with the kit
library in `vendor/`, and adds `build-info.json` with file counts and sizes.

## License

MIT — see `LICENSE`. All art, names, story and sound in this game are original.
