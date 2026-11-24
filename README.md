# SOLMAR BAY — Make GTA 6 (make.fun gta6-01)

A complete open-world crime game that runs offline in a desktop browser from
static files. Built from scratch with Three.js (vendored under `game/vendor/`).

## Play

```sh
node serve.ts        # then open http://127.0.0.1:8901/game/index.html
```

Or open `game/index.html` directly from any static file server.

## The game

You are Vic, fresh out of the marina lockup with $120 and a borrowed pistol.
Mara and Dario have five jobs for you across Solmar Bay, a sun-soaked coastal
city: steal cars, run beachfront pickups, dodge the Solmar Bay PD, and bring
the final gold coupe home.

- **City** — a 9×9 road grid with procedural towers, beachfront, ocean, palms,
  streetlights and drifting clouds
- **Driving** — steal any parked car (E), arcade handling, handbrake, traffic
- **On foot** — third-person walking and sprinting, mouse-look camera
- **Combat** — hitscan pistol with tracers and muzzle flash, reload, ammo
- **Wanted** — 0–5 star heat, police cruisers that chase and ram, busted/wasted
- **Missions** — 5 story jobs with beacon markers, HUD tracking and cash rewards
- **HUD** — health/ammo bars, wanted stars, cash, radio station, live minimap
- **Sound** — synthesized WebAudio: engine hum, three radio stations, sirens
- **Save** — progress autosaves to localStorage; continue from the menu

## Controls

WASD move / drive · Shift sprint · E enter/exit car · Mouse aim, Click shoot ·
R reload · Q radio · Space handbrake · P pause · M mute

## Self test & screenshots

- `?selftest=1` runs the in-browser self test and reports PASS/FAIL.
- `?shot=drive|street|mission|start` stages a composed scene for screenshots
  (see `shots.json`); the page sets `window.__shotReady` once settled.

## Build the dossier

```sh
MAKEFUN_OUTPUT_DIR=/tmp/solmar-out2 node main.ts
```

This copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` (makefun/dossier/v1) with the kit library in `vendor/`.

## License

MIT — see `LICENSE`. All art, names, story and sound in this game are original.
