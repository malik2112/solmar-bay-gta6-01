// SOLMAR BAY — entry point. Wires the city, vehicles, missions, HUD, view,
// player, audio, combat, pedestrians and wanted system into one game loop,
// plus the save flow, pause/death handling, the ?shot= staging presets and
// the ?selftest=1 harness. The state object is the single shared handle
// every system reads: selftest and shots.js both drive the game through it.

import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { buildBayCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createView } from './render.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createAudio } from './audio.js';
import { createCombat } from './combat.js';
import { createPedestrians } from './pedestrians.js';
import { createWanted } from './wanted.js';
import { defaultSave, loadSave, writeSave } from './save.js';
import { runSelftest } from './selftest.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const selftestMode = params.get('selftest') === '1';

// -- build the world -----------------------------------------------------------
const view = createView();
const scene = view.scene;
const camera = view.camera;

const city = buildBayCity(scene);
const input = createInput(rendererDom());
const player = createPlayer(scene, city);
const audio = createAudio();
const combat = createCombat(scene, camera);
const peds = createPedestrians(scene, city);
const vehicles = createVehicles(scene, city);
const wanted = createWanted(scene, city);
const missions = createMissions(vehicles);

// Tag ped groups so the shooting callback can tell a person from a car.
for (const p of peds.peds) p.group.userData.kind = 'ped';

const raycaster = new THREE.Raycaster();

// Mission beacon: a pulsing red column over the current objective.
const beaconMat = new THREE.MeshBasicMaterial({
  color: PALETTE.marker,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
});
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 30, 12, 1, true), beaconMat);
beacon.position.y = 15;
scene.add(beacon);
const beaconTop = new THREE.Mesh(
  new THREE.SphereGeometry(1.6, 10, 8),
  new THREE.MeshBasicMaterial({ color: PALETTE.beacon })
);
beaconTop.position.y = 30;
beacon.add(beaconTop);

// -- shared state ---------------------------------------------------------------
const state = {
  THREE,
  view,
  scene,
  camera,
  city,
  vehicles,
  peds,
  missions,
  hud: null, // set below (hud needs the callbacks that close over state)
  player,
  input,
  wanted,
  combat,
  audio,
  mode: 'menu', // 'menu' | 'playing' | 'paused'
  paused: false,
  money: CONFIG.startMoney,
  health: CONFIG.startHealth,
  missionsDone: [],
  missionIndex: 0,
  radioStation: 0,
  playSeconds: 0,
  dayMinutes: 480, // 08:00
  shotName,
  settleFrames: 0,
  menuOrbit: 0,
  shotCruise: false,
  respawnIn: 0,
  respawnKind: null,
  saveTimer: 0,
  lastHealth: CONFIG.startHealth,
  onAllMissionsDone() {
    state.money += 2000;
    if (state.hud) state.hud.toast('Story bonus +$2000 — you own the bay.');
  },
};

function rendererDom() {
  return view.renderer.domElement;
}

const hud = createHud({
  onStart(fromSave) {
    startGame(fromSave);
  },
  onResume() {
    setPaused(false);
  },
  onQuit() {
    state.mode = 'menu';
    state.paused = false;
    hud.showMenu(true);
  },
});
state.hud = hud;

function startGame(fromSave) {
  const save = fromSave ? loadSave() : null;
  if (save) {
    state.money = save.money;
    state.missionsDone = save.missionsDone.slice();
    state.missionIndex = save.missionIndex;
    state.radioStation = save.radio || 0;
    state.playSeconds = save.playSeconds || 0;
    missions.applySave(save.missionsDone, save.missionIndex);
    player.health = save.health;
    player.setPosition(save.player.x, save.player.z, save.player.heading);
    audio.setStation(state.radioStation);
  } else {
    const fresh = defaultSave();
    state.money = fresh.money;
    state.missionsDone = [];
    state.missionIndex = 0;
    state.radioStation = 0;
    state.playSeconds = 0;
    player.health = CONFIG.startHealth;
    player.ammo = CONFIG.pistolAmmo;
    player.ammoReserve = 60;
    missions.applySave([], 0);
    player.setPosition(0, 120, 0);
    wanted.setStars(0);
  }
  state.health = player.health;
  state.lastHealth = player.health;
  missions.start();
  state.mode = 'playing';
  state.paused = false;
  hud.hideMenu();
  hud.clearCenter();
  const def = missions.currentDef();
  if (def) hud.toast(`${def.name} — ${def.giver}: ${def.brief}`, 5200);
  audio.unlock();
  input.requestLock();
}

function setPaused(on) {
  if (state.mode !== 'playing') return;
  state.paused = on;
  if (on) {
    const mins = Math.floor(state.playSeconds / 60);
    hud.showPause(
      `Cash $${Math.floor(state.money)} · Jobs ${missions.done.length}/5 · Played ${mins} min · Wanted ${wanted.stars}★`
    );
  } else {
    hud.hidePause();
  }
}

function respawn(kind) {
  player.health = CONFIG.startHealth;
  player.dead = false;
  player.setPosition(0, 120, 0);
  player.camYaw = 0;
  if (player.inCar) {
    player.inCar.driver = null;
    player.inCar.parked = true;
    player.inCar.speed = 0;
    player.inCar = null;
    player.group.visible = true;
  }
  wanted.setStars(0);
  wanted.busted = false;
  wanted.bustTimer = 0;
  state.money = Math.max(0, state.money - (kind === 'busted' ? 150 : 120));
  state.health = player.health;
  state.lastHealth = player.health;
  hud.clearCenter();
  hud.toast(kind === 'busted' ? 'Busted — the PD took $150 and your ride.' : 'Wasted — patched up at the marina clinic, $120 lighter.');
}

// -- shooting --------------------------------------------------------------------
function shootTargets() {
  const targets = [];
  for (const p of peds.peds) targets.push(p.group);
  for (const car of vehicles.cars) targets.push(car.mesh);
  for (const cop of wanted.police) targets.push(cop.mesh);
  return targets;
}

function onShotHit(hit) {
  let o = hit.object;
  while (o) {
    if (o.userData && o.userData.car) {
      const car = o.userData.car;
      if (car.kind === 'police') {
        wanted.addHeat(1.2);
        hud.toast('You shot a cop car — the heat is on.');
      } else {
        wanted.addHeat(0.3);
      }
      return;
    }
    if (o.userData && o.userData.kind === 'ped') {
      wanted.addHeat(0.7);
      peds.scare(player.x, player.z, 30);
      hud.toast('You hit a civilian — witnesses called the PD.');
      return;
    }
    o = o.parent;
  }
}

function tryShoot() {
  if (state.mode !== 'playing' || state.paused || player.dead) return;
  if (player.inCar) return; // no drive-by shooting in this build
  const result = combat.tryShoot(player, raycaster, shootTargets(), audio, onShotHit);
  if (result === 'hit' || result === 'miss') {
    peds.scare(player.x, player.z, 26);
  } else if (result === 'empty') {
    hud.hint('Out of ammo — press R to reload');
  }
}

// -- car entry / exit ---------------------------------------------------------------
function nearestEnterableCar() {
  return vehicles.nearestCar(player.x, player.z, 6);
}

function enterCar() {
  const car = nearestEnterableCar();
  if (!car) return;
  const wasParked = car.parked;
  car.parked = false;
  car.driver = 'player';
  const ti = vehicles.traffic.indexOf(car);
  if (ti < 0) vehicles.traffic.push(car);
  player.inCar = car;
  player.group.visible = false;
  car.speed = 0;
  audio.blip();
  if (wasParked) {
    wanted.addHeat(0.4);
    hud.toast(car.name ? `Stole the ${car.name} — nice wheels.` : 'Stole a parked car.');
  } else {
    hud.toast('You are driving.');
  }
}

function exitCar() {
  const car = player.inCar;
  if (!car) return;
  const sideX = car.x + Math.cos(car.heading) * 2.4;
  const sideZ = car.z - Math.sin(car.heading) * 2.4;
  player.inCar = null;
  player.group.visible = true;
  player.setPosition(sideX, sideZ, car.heading);
  car.driver = null;
  car.parked = true;
  car.speed = 0;
  const pi = vehicles.parked.indexOf(car);
  if (pi < 0) vehicles.parked.push(car);
  audio.blip();
}

// -- input edges, once per frame -----------------------------------------------------
function handleInputEdges() {
  if (input.wasPressed('KeyE')) {
    if (player.inCar) exitCar();
    else enterCar();
  }
  if (input.wasPressed('KeyP')) setPaused(!state.paused);
  if (input.wasPressed('KeyM')) {
    audio.setMuted(!audio.isMuted());
    hud.toast(audio.isMuted() ? 'Sound muted' : 'Sound on');
  }
  if (input.wasPressed('KeyQ')) {
    state.radioStation = audio.setStation(state.radioStation + 1);
    hud.toast(`Radio: ${audio.stationName()}`);
  }
  if (input.wasPressed('KeyR')) {
    if (!combat.reload(player, audio)) hud.hint('Magazine already full');
  }
  if (input.wasPressed('KeyH')) {
    audio.horn();
  }
  if (input.mouse.clicked) tryShoot();
}

// -- main loop -------------------------------------------------------------------------
const clock = new THREE.Clock();
let elapsed = 0;
const cruiseInput = {
  axis() {
    return { x: 0, z: -1 };
  },
  down() {
    return false;
  },
  wasPressed() {
    return false;
  },
  mouse: { dx: 0, dy: 0 },
};

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  if (state.mode === 'menu') {
    state.menuOrbit += dt;
    city.update(dt, elapsed);
    vehicles.update(dt);
    view.updateCamera(dt, player, { mode: 'menu', menuOrbit: state.menuOrbit });
    view.render();
  } else if (state.mode === 'playing' && state.paused) {
    // Paused: only the pause key is live, so P can always unpause.
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) setPaused(false);
    view.render();
  } else if (state.mode === 'playing' && !state.paused) {
    state.playSeconds += dt;
    state.dayMinutes = (state.dayMinutes + dt * 2) % 1440;
    handleInputEdges();

    if (state.respawnIn > 0) {
      state.respawnIn -= dt;
      if (state.respawnIn <= 0 && state.respawnKind) {
        respawn(state.respawnKind);
        state.respawnKind = null;
      }
    } else if (!player.dead) {
      player.update(dt, input, state);
      if (player.inCar) {
        const driving = state.shotCruise ? cruiseInput : input;
        vehicles.driveCar(player.inCar, driving, dt, city);
        // Handbrake at speed squeals the tyres (throttled so it stays a squeal).
        state.skidTimer = (state.skidTimer || 0) - dt;
        if (!state.shotCruise && input.down('Space') && Math.abs(player.inCar.speed) > 14 && state.skidTimer <= 0) {
          audio.skid();
          state.skidTimer = 0.55;
        }
      }
      vehicles.update(dt);
      peds.update(dt, wanted.stars);
      wanted.update(dt, player, vehicles, audio);
      combat.update(dt, elapsed);
      missions.update(state, dt);
      city.update(dt, elapsed);

      // Damage flash when health drops.
      if (player.health < state.lastHealth) hud.flashDamage();
      state.lastHealth = player.health;
      state.health = player.health;
      state.missionIndex = missions.index;
      state.missionsDone = missions.done;

      // Wasted / busted transitions.
      if (player.dead && !state.respawnKind) {
        state.respawnKind = 'wasted';
        state.respawnIn = 2.5;
        hud.showCenter('WASTED', 2400);
        view.flash('#c0392b', 0.35);
      } else if (wanted.busted && !state.respawnKind) {
        state.respawnKind = 'busted';
        state.respawnIn = 2.5;
        hud.showCenter('BUSTED', 2400);
        view.flash('#1a5276', 0.35);
      }

      // Engine hum follows the driven car.
      const carSpeed01 = player.inCar ? Math.abs(player.inCar.speed) / CONFIG.carTopSpeed : 0;
      audio.setEngine(carSpeed01, !!player.inCar);

      // Autosave every 12 s (not while staging screenshots).
      state.saveTimer += dt;
      if (state.saveTimer > 12 && !shotName) {
        state.saveTimer = 0;
        writeSave(state);
      }
    }

    // Mission beacon.
    const marker = missions.markerPos();
    if (marker && !player.dead) {
      beacon.visible = true;
      beacon.position.x = marker.x;
      beacon.position.z = marker.z;
      const pulse = 1 + Math.sin(elapsed * 3) * 0.12;
      beacon.scale.set(pulse, 1, pulse);
      beaconMat.opacity = 0.26 + Math.sin(elapsed * 3) * 0.08;
    } else {
      beacon.visible = false;
    }

    view.updateCamera(dt, player, { mode: 'playing' });
    hud.update(state);
    view.render();
  } else {
    // Paused: hold the frame, still render so the pause overlay sits on the world.
    view.render();
  }

  // Screenshot settling: the driver waits on window.__shotReady.
  if (shotName && state.settleFrames > 0) {
    state.settleFrames--;
    if (state.settleFrames === 0) window.__shotReady = true;
  }
  input.endFrame();
}

// -- boot --------------------------------------------------------------------------------
window.addEventListener('mousedown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

if (shotName) {
  // Fresh staging for the screenshot: no save, menu closed by the preset.
  view.applyGoldenHour(shotName === 'start' ? 0.8 : 0.25);
  hud.showMenu(false);
  applyShot(shotName, state);
  if (shotName === 'start') state.mode = 'menu';
} else {
  const existing = loadSave();
  hud.showMenu(!!existing);
  if (existing) {
    hud.toast(`Save found — ${existing.missionsDone.length}/5 jobs done, $${existing.money}.`, 4200);
  }
}

window.__solmarReady = true;
window.__shotReady = false;
if (!shotName) window.__shotReady = true;
window.__solmar = state;

frame();

if (selftestMode) {
  // Let one frame render, then run the harness (it drives its own ticks).
  setTimeout(() => {
    try {
      runSelftest(state);
    } catch (err) {
      document.title = `SELFTEST ERROR ${String(err && err.message ? err.message : err)}`;
    }
  }, 300);
}
