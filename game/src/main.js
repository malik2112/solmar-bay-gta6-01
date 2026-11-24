// SOLMAR BAY — boot and the main loop: menu, driving, shooting, missions,
// wanted, busted/wasted, pause, autosave, selftest and screenshot staging.

import * as THREE from 'three';
import { CONFIG, MISSIONS } from './config.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createPlayer } from './player.js';
import { createVehicleSystem } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createWanted } from './wanted.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { loadSave, writeSave } from './save.js';
import { runSelftest } from './selftest.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const app = document.getElementById('app');
const view = createRenderer(app);
const city = buildCity(view.scene);
const player = createPlayer(view.scene, city);
const vehicles = createVehicleSystem(view.scene, city);
const peds = createPedestrians(view.scene, city);
const wanted = createWanted(view.scene, city);
const combat = createCombat(view.scene, view.camera);
const missions = createMissions(view.scene, city);
const audio = createAudio();
const input = createInput(view.domElement);

const state = {
  THREE,
  view,
  scene: view.scene,
  camera: view.camera,
  city,
  player,
  vehicles,
  peds,
  wanted,
  combat,
  missions,
  audio,
  input,
  hud: null,
  money: CONFIG.startMoney,
  health: CONFIG.startHealth,
  radioStation: 0,
  playSeconds: 0,
  mode: 'menu', // menu | playing | paused | busted | wasted
  menuOrbit: 0,
  modeTimer: 0,
  saveTimer: 0,
  shotName: null,
  settleFrames: 0,
};
const hud = createHud(state);
state.hud = hud;

const raycaster = new THREE.Raycaster();
const saved = loadSave();

function doSave() {
  state.health = player.health;
  writeSave(state);
}

function startGame(useSave) {
  audio.unlock();
  if (useSave && saved) {
    state.money = saved.money;
    player.health = saved.health;
    player.setPosition(saved.player.x, saved.player.z, saved.player.heading);
    audio.setStation(saved.radio);
    state.radioStation = saved.radio;
    state.playSeconds = saved.playSeconds || 0;
    missions.applySave(saved.missionsDone, saved.missionIndex);
  } else {
    state.money = CONFIG.startMoney;
    player.health = CONFIG.startHealth;
    player.setPosition(0, 120, 0);
    missions.applySave([], 0);
  }
  wanted.setStars(0);
  player.dead = false;
  state.mode = 'playing';
  hud.hideMenu();
  missions.start();
  const def = missions.currentDef();
  if (def) hud.toast(`Mission ${missions.index + 1}: ${def.name} — ${def.giver}: ${def.brief}`);
  input.requestLock();
}

hud.onPlay(startGame);
hud.showMenu(!!saved);

function topGroupOf(obj) {
  let o = obj;
  while (o && o.parent && o.parent !== view.scene) o = o.parent;
  return o;
}

function shootTargets() {
  const list = [];
  for (const p of peds.peds) list.push(p.group);
  for (const c of wanted.police) list.push(c.mesh);
  for (const c of vehicles.traffic) list.push(c.mesh);
  for (const c of vehicles.cars) {
    if (c.driver !== 'ai' && c.driver !== 'player' && !c.parked) list.push(c.mesh);
  }
  return list;
}

function onShootHit(hit) {
  const top = topGroupOf(hit.object);
  const ped = peds.peds.find((p) => p.group === top);
  if (ped) {
    view.scene.remove(ped.group);
    peds.peds.splice(peds.peds.indexOf(ped), 1);
    wanted.addHeat(2);
    peds.scare(ped.x, ped.z, 40);
    hud.toast('You shot a civilian — the PD is coming.');
    return;
  }
  const cop = wanted.police.find((c) => c.mesh === top);
  if (cop) {
    cop.speed *= 0.5;
    wanted.addHeat(1);
    hud.toast('You shot at the police!');
    return;
  }
  const car = vehicles.cars.find((c) => c.mesh === top);
  if (car) {
    car.speed = 0;
    wanted.addHeat(1);
  }
}

function enterCar(car) {
  const ti = vehicles.traffic.indexOf(car);
  if (ti >= 0) vehicles.traffic.splice(ti, 1);
  car.driver = 'player';
  car.parked = false;
  player.inCar = car;
  player.group.visible = false;
  if (!car.owned) {
    car.owned = true;
    wanted.addHeat(1);
    hud.toast('Car stolen! Lose the heat or keep driving.');
    audio.blip();
    const ev = missions.onCarStolen();
    if (ev === 'step') hud.toast(`Objective done — ${missions.stepDef().text}`);
    if (ev === 'complete') completeMission();
  } else {
    audio.blip();
  }
}

function exitCar() {
  const car = player.inCar;
  if (!car) return;
  car.driver = null;
  car.parked = true;
  car.speed = 0;
  player.inCar = null;
  const sideX = Math.cos(car.heading) * 3;
  const sideZ = -Math.sin(car.heading) * 3;
  player.setPosition(car.x + sideX, car.z + sideZ, car.heading);
  player.group.visible = true;
  player.camYaw = car.heading;
}

function completeMission() {
  const finished = missions.done[missions.done.length - 1];
  const def = MISSIONS.find((m) => m.id === finished);
  if (def) {
    state.money += def.reward;
    audio.cash();
    hud.toast(`Mission complete: ${def.name} — +$${def.reward}`);
    hud.center(`MISSION COMPLETE — ${def.name}  +$${def.reward}`, 3000);
  }
  doSave();
  if (missions.isFinished()) {
    hud.center('ALL MISSIONS COMPLETE — Solmar Bay is yours!', 5000);
    return;
  }
  missions.start();
  const next = missions.currentDef();
  if (next) hud.toast(`Next mission: ${next.name} — ${next.brief}`);
}

let last = performance.now();
let firstFrame = true;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  const t = now / 1000;

  if (state.mode === 'menu') {
    state.menuOrbit += dt * 0.045;
    const a = state.menuOrbit;
    view.camera.position.set(Math.sin(a) * 190, 62, 40 + Math.cos(a) * 190);
    view.camera.lookAt(0, 12, 60);
    city.update(dt, t);
    vehicles.update(dt);
    peds.update(dt, 0);
  } else if (state.mode === 'playing') {
    state.playSeconds += dt;

    // Pause / mute / radio.
    if (input.wasPressed('KeyP')) {
      state.mode = 'paused';
      hud.center('PAUSED — press P to resume', 999999);
    }
    if (input.wasPressed('KeyM')) {
      audio.setMuted(!audio.isMuted());
      hud.toast(audio.isMuted() ? 'Sound muted' : 'Sound on');
    }
    if (input.wasPressed('KeyQ')) {
      state.radioStation = audio.setStation(state.radioStation + 1);
      hud.toast(`Radio: ${audio.stationName()}`);
    }
    if (input.wasPressed('KeyR')) combat.reload(player, audio);

    // Enter / exit car.
    if (input.wasPressed('KeyE')) {
      if (player.inCar) {
        exitCar();
      } else {
        const car = vehicles.nearestCar(player.x, player.z, 4.5, (c) => c.kind !== 'police');
        if (car) enterCar(car);
        else hud.hint('No car nearby — walk up to a parked car and press E');
      }
    }

    // Driving or walking.
    if (player.inCar) {
      const ax = input.axis();
      const throttle = state.shotCruise ? 0.6 : -ax.z;
      const steer = state.shotCruise ? 0 : ax.x;
      vehicles.drive(player.inCar, throttle, steer, dt, input.down('Space'));
      audio.setEngine(Math.abs(player.inCar.speed) / CONFIG.carTopSpeed, true);
    } else {
      player.update(dt, input, state);
      audio.setEngine(0, false);
      // Shoot on foot with the mouse.
      if (input.mouse.clicked) {
        const res = combat.tryShoot(player, raycaster, shootTargets(), audio, onShootHit);
        if (res === 'hit' || res === 'miss') peds.scare(player.x, player.z, 25);
        if (res === 'empty') hud.hint('Out of ammo — press R to reload');
      }
    }

    city.update(dt, t);
    vehicles.update(dt);
    peds.update(dt, wanted.stars);
    wanted.update(dt, player, vehicles, audio);
    combat.update(dt, t);

    // Mission progress.
    const ev = missions.update(state, dt);
    if (ev === 'step') {
      const s = missions.stepDef();
      hud.toast(`Objective done — ${s ? s.text : ''}`);
      audio.blip();
    } else if (ev === 'complete') {
      completeMission();
    }

    // Busted / wasted.
    if (wanted.busted) {
      state.mode = 'busted';
      state.modeTimer = 3.5;
      state.money = Math.max(0, state.money - 300);
      wanted.setStars(0);
      wanted.busted = false;
      if (player.inCar) exitCar();
      player.setPosition(0, 120, 0);
      player.health = CONFIG.startHealth;
      hud.center('BUSTED! The Solmar Bay PD caught you. Fine: $300', 3400);
      doSave();
    } else if (player.dead) {
      state.mode = 'wasted';
      state.modeTimer = 3.5;
      state.money = Math.max(0, state.money - 150);
      if (player.inCar) exitCar();
      player.setPosition(0, 120, 0);
      hud.center('WASTED! You wake up at the marina clinic. -$150', 3400);
      doSave();
    }

    // Autosave every 10 seconds.
    state.saveTimer += dt;
    if (state.saveTimer > 10) {
      state.saveTimer = 0;
      doSave();
    }

    view.updateCamera(dt, player);
    hud.update(state);
  } else if (state.mode === 'paused') {
    if (input.wasPressed('KeyP')) {
      state.mode = 'playing';
      hud.center('', 1);
    }
  } else if (state.mode === 'busted' || state.mode === 'wasted') {
    state.modeTimer -= dt;
    if (state.modeTimer <= 0) {
      player.dead = false;
      player.health = CONFIG.startHealth;
      state.mode = 'playing';
      hud.center('', 1);
    }
    view.updateCamera(dt, player);
  }

  view.render();
  input.endFrame();

  if (state.settleFrames > 0) {
    state.settleFrames -= 1;
    if (state.settleFrames === 0) window.__shotReady = true;
  }

  if (firstFrame) {
    firstFrame = false;
    window.__solmar = state;
    window.__solmarReady = true;
    if (params.has('selftest')) runSelftest(state);
  }
}

if (params.has('shot')) {
  applyShot(params.get('shot'), state);
  hud.update(state);
}

requestAnimationFrame(frame);
