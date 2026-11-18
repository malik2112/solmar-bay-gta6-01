// Staged screenshot scenes (?shot=drive|street|mission|start, &seed=N).
// Each one plays the real rules forward from a fresh world with a scripted
// driver, so the frame is what the game really looks like — same seed,
// same frame. Sets window.__shotReady via main.js after painting twice.
import { STEP, HUB, PLACES, roadCenter } from './config.js';

// Edge actions (E to steal) only come from real key events — virtual input
// holds keys down but never "presses" them — so stage the steal with one.
function pressKey(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

function stepN(game, seconds) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) game.step(STEP);
}

export function stageShot(name, game) {
  const g = game;
  g.screen = 'play';
  g.hud.hideScreens();
  g.input.virtual = null;
  if (name === 'start') {
    // Title over the city at dusk: traffic and crowds drifting, bay behind.
    g.screen = 'title';
    stepN(g, 3);
    return { screen: 'title' };
  }
  if (name === 'street') {
    // On foot outside Rosa's Garage: pedestrians around, first job offered.
    g.player.x = HUB.x + 8; g.player.z = HUB.z + 6;
    g.player.heading = Math.PI * 0.75;
    g.player.sync();
    // Pull a few pedestrians into the frame so the street feels alive.
    const spots = [[-6, -4], [5, -7], [-3, 7], [8, 3]];
    for (let i = 0; i < 4; i++) {
      const p = g.peds[i];
      p.x = g.player.x + spots[i][0]; p.z = g.player.z + spots[i][1];
      p.target = { x: g.player.x - spots[i][0], z: g.player.z - spots[i][1] };
      p.sync();
    }
    g.rig.distance = 9;
    g.talkToRosa();
    stepN(g, 2);
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // Sunset Courier: in a car near Marina Norte, beacon up, clock running.
    // Approach along the west road (z = marina row, no sheds on that line),
    // so the car ends up beside the beacon instead of wedged on a shed.
    g.missions.index = 3;
    g.talkToRosa();
    const car = g.traffic[0];
    car.x = roadCenter(4); car.z = PLACES.marina.z;
    car.heading = Math.PI / 2; // east, toward the marina
    car.speed = 0; car.sync();
    g.player.x = car.x + 2; g.player.z = car.z + 2; g.player.sync();
    pressKey('KeyE');
    stepN(g, 0.2);
    g.input.virtual = { up: true };
    stepN(g, 2.5);
    g.input.virtual = null;
    return { screen: 'play' };
  }
  // Default: 'drive' — the cover. Stolen car tearing down the main avenue at
  // dusk, 3 stars, two cruisers flanking, Rosa's job on the HUD.
  g.wanted.addHeat(55);
  const car = g.traffic[0];
  car.x = roadCenter(3) + 3.2; car.z = 120;
  car.heading = Math.PI; // north, up the avenue
  car.speed = 0; car.sync();
  g.player.x = car.x + 2; g.player.z = car.z + 2; g.player.sync();
  pressKey('KeyE');
  stepN(g, 0.3);
  g.input.virtual = { up: true };
  g.talkToRosa();
  g.rig.distance = 10;
  stepN(g, 4);
  g.input.virtual = null;
  // Park one cruiser in the frame: flanking the player's car, lights flashing,
  // so the cover shows the chase instead of only hinting at it on the minimap.
  const cop = g.wanted.policeCars[0];
  if (cop) {
    const v = g.player.vehicle;
    const f = v.forward();
    // Flank on the car's left (screen-left from the chase camera), 2 m ahead:
    // a cruiser the camera can actually see, not one hiding behind the car.
    cop.x = v.x + Math.cos(v.heading) * 7 + f.x * 2;
    cop.z = v.z - Math.sin(v.heading) * 7 + f.z * 2;
    cop.heading = v.heading;
    cop.speed = v.speed;
    cop.sync();
  }
  return { screen: 'play' };
}
