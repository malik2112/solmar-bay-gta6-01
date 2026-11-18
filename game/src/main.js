// SOLMAR BAY — boot and the one loop.
// ?seed=N fixes the city. ?shot=drive|street|mission|start stages a screenshot
// scene instead of running the loop. ?selftest=1 runs the 12 in-game checks.
// The loop advances in fixed 1/60 s steps and paints what is there.
import * as THREE from 'three';
import { STEP, CITY, HUB, BOOT_DELAY_MS, WANTED, dist2d } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_SHOOT, ACTION_RELOAD, ACTION_RADIO } from './input.js';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { spawnTraffic, nearestVehicle } from './vehicles.js';
import { spawnPeds, Ped } from './pedestrians.js';
import { Wanted } from './wanted.js';
import { MissionManager } from './missions.js';
import { Combat } from './combat.js';
import { AudioEngine } from './audio.js';
import { createHud } from './hud.js';
import { createRenderer, CameraRig } from './render.js';
import { saveGame, loadGame } from './save.js';
import { stageShot } from './shots.js';
import { runSelfTest } from './selftest.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

export function createGame(canvas) {
  const rng = createRandom(seed);
  const { renderer, scene, camera } = createRenderer(canvas);
  const city = buildCity(scene, rng);
  const hud = createHud(document);
  const input = createInput(canvas);
  const rig = new CameraRig(camera);
  const audio = new AudioEngine();
  const player = new Player(scene, HUB.x + 6, HUB.z + 4);
  const traffic = spawnTraffic(scene, rng, city.half);
  const peds = spawnPeds(scene, rng, city.half);
  const wanted = new Wanted(scene, rng);
  const missions = new MissionManager(scene);
  const combat = new Combat(scene);

  const game = {
    scene, renderer, camera, rig, hud, input, audio, city, rng,
    player, traffic, peds, wanted, missions, combat,
    time: 0, screen: 'title', saveTimer: 0, orbitAngle: 0.6,
    events: [],
    saved: loadGame(),
    allVehicles() {
      const list = [...this.traffic, ...this.wanted.policeCars];
      if (this.player.vehicle) list.push(this.player.vehicle);
      return list;
    },
    camYaw() {
      return Math.atan2(this.rig.look.x - this.rig.pos.x, this.rig.look.z - this.rig.pos.z);
    },
    toast(msg) {
      this.events.push(msg);
      this.hud.showToast(msg);
      this.hud.announce(msg);
    },
    // One fixed simulation step. Only 'play' moves the player, police and missions;
    // the title screen still lets traffic and crowds drift so it feels alive.
    step(dt) {
      this.time += dt;
      player.time = this.time;
      for (const v of this.traffic) v.aiStep(dt, this.rng, this.city.colliders, this.city.half, this.allVehicles());
      for (const p of this.peds) p.update(dt, this.city.half);
      if (this.screen !== 'play') return;
      const keys = this.input.read();
      const actions = this.input.takeActions();
      if (this.input.briefPressed()) this.talkToRosa();
      if (actions & ACTION_RADIO) {
        this.audio.radioOn = !this.audio.radioOn;
        this.toast(this.audio.radioOn ? 'Radio on — Solmar FM.' : 'Radio off.');
      }
      if (actions & ACTION_PAUSE) { this.pauseGame(); return; }
      if (actions & ACTION_ENTER) this.toggleCar();
      if (actions & ACTION_RELOAD) this.combat.reload();
      const targets = [...this.peds];
      if (actions & ACTION_PUNCH) {
        this.combat.punch(this.player, targets, this.events, (h) => this.crime(h));
        this.audio.punch();
      }
      if (actions & ACTION_SHOOT) {
        this.combat.shoot(this.player, targets, this.events, (h) => this.crime(h), this.audio);
      }
      if (this.player.vehicle) {
        const v = this.player.vehicle;
        v.driveStep(dt, {
          throttle: keys.up ? 1 : keys.down ? -1 : 0,
          steer: (keys.left ? 1 : 0) - (keys.right ? 1 : 0),
        }, this.city.colliders, this.city.half, this.allVehicles());
        // Bumping pedestrians while driving is a crime too.
        for (const p of this.peds) {
          if (p.state !== 'dead' && Math.abs(v.speed) > 4 && dist2d(v.x, v.z, p.x, p.z) < 2.2) {
            if (p.damage(100, v.x, v.z)) this.crime(WANTED.killHeat);
            else this.crime(WANTED.assaultHeat);
          }
        }
      } else {
        this.player.stepOnFoot(dt, keys, this.camYaw(), this.city.colliders, this.city.half);
      }
      this.wanted.update(dt, this.player, this.city.colliders, this.city.half, this.traffic, () => this.getBusted());
      if (this.wanted.level > 0) this.wanted.decay(dt * 0.4); // heat fades slowly even mid-chase
      const mEvent = this.missions.update(dt, this.player, this.wanted.level, this.events);
      if (mEvent === 'complete') {
        const m = this.missions.current;
        const done = this.missions.completedCount;
        const reward = [250, 400, 600, 800, 1500][done - 1] ?? 0;
        this.player.money += reward;
        this.audio.missionDone();
        this.toast(`$${reward} banked. ${this.missions.current ? `Next: ${this.missions.current.name}.` : 'All jobs done!'}`);
        saveGame(this);
      }
      this.combat.update(dt);
      this.audio.setEngine(this.player.vehicle ? this.player.vehicle.speed : 0, !!this.player.vehicle);
      this.audio.setSiren(this.wanted.sirenOn, this.time);
      this.audio.radioTick(dt);
      if (this.player.health <= 0) this.getWasted();
      this.saveTimer += dt;
      if (this.saveTimer > 10) { this.saveTimer = 0; saveGame(this); }
      while (this.events.length) this.hud.showToast(this.events.shift());
    },
    crime(heat) {
      this.wanted.addHeat(heat);
      for (const p of this.peds) {
        if (dist2d(p.x, p.z, this.player.x, this.player.z) < 22) p.scare(this.player.x, this.player.z);
      }
    },
    talkToRosa() {
      if (this.missions.active) {
        const m = this.missions.current;
        this.toast(`${m.name}: ${this.missions.step ? this.missions.step.label : ''}`);
        return;
      }
      const m = this.missions.current;
      if (!m) { this.toast('Rosa: That is all five jobs, kid. The bay is yours.'); return; }
      this.missions.start();
      this.audio.pickup();
      this.toast(`New job — ${m.name}: ${m.brief}`);
    },
    toggleCar() {
      if (this.player.vehicle) {
        const v = this.player.exitCar();
        v.ai = null; // stays parked where you left it; you can steal it back
        this.traffic.push(v);
        this.toast('You step out.');
        return;
      }
      const v = nearestVehicle(this.traffic, this.player.x, this.player.z, 4.5);
      if (!v) { this.toast('No car close enough. Get nearer and press E.'); return; }
      const idx = this.traffic.indexOf(v);
      if (idx >= 0) this.traffic.splice(idx, 1);
      this.player.enterCar(v);
      this.crime(WANTED.stealHeat);
      // The driver bails and runs.
      const driver = new Ped(this.scene, this.rng, v.x + 2, v.z + 2);
      driver.scare(v.x, v.z);
      this.peds.push(driver);
      this.audio.pickup();
      this.toast('You stole the car! Lose the heat or bring it to Rosa.');
    },
    getBusted() {
      this.screen = 'busted';
      this.player.money = Math.max(0, this.player.money - 150);
      this.audio.busted();
      this.hud.hideHud();
      this.hud.showScreen('busted');
      this.hud.announce('Busted! The cops impound your ride and fine you $150.');
      saveGame(this);
    },
    getWasted() {
      this.screen = 'wasted';
      this.hud.hideHud();
      this.hud.showScreen('wasted');
      this.hud.announce('Wasted! You wake up outside the garage.');
      saveGame(this);
    },
    respawn() {
      this.player.vehicle = null;
      this.player.x = HUB.x + 6; this.player.z = HUB.z + 4;
      this.player.heading = Math.PI;
      this.player.health = 100;
      this.player.sync();
      this.wanted.reset();
      this.screen = 'play';
      this.hud.hideScreens();
      this.hud.showHud();
      this.toast("Rosa patched you up. Do not make a habit of it.");
    },
    startGame(fromSave) {
      if (fromSave && this.saved) {
        this.player.money = this.saved.money || 0;
        this.missions.completedCount = this.saved.missionsDone || 0;
        this.missions.index = this.saved.missionIndex || 0;
        if (typeof this.saved.x === 'number') { this.player.x = this.saved.x; this.player.z = this.saved.z; }
        this.player.sync();
        this.toast(`Welcome back — $${Math.floor(this.player.money)} in your pocket.`);
      } else {
        this.player.money = 0;
        this.toast("Rosa Delgado runs this town. Press M to take your first job.");
      }
      this.screen = 'play';
      this.hud.hideScreens();
      this.hud.showHud();
      this.hud.announce('Playing SOLMAR BAY. Press M for a job, E to steal a car.');
    },
    pauseGame() {
      this.screen = 'pause';
      this.hud.hideHud();
      this.hud.showScreen('pause');
      saveGame(this);
      this.hud.announce('Paused. Progress saved.');
    },
    resumeGame() {
      this.screen = 'play';
      this.hud.hideScreens();
      this.hud.showHud();
    },
    // Paint one frame: camera + HUD, no simulation.
    paint() {
      const p = this.player;
      if (this.screen === 'title') {
        this.orbitAngle += 0.004;
        const cx = Math.sin(this.orbitAngle) * 190;
        const cz = Math.cos(this.orbitAngle) * 190 + 20;
        this.rig.setShot(cx, 60, cz, 0, 4, 30);
      } else {
        const v = p.vehicle;
        const drag = this.input.takeCamera();
        this.rig.applyDrag(drag.dx, drag.dy, drag.wheel);
        this.rig.follow(1 / 60, v ? v.x : p.x, v ? v.z : p.z, v ? v.heading : p.heading, !!v, v ? v.speed : 0);
      }
      this.hud.update(this, 1 / 60);
      this.renderer.render(this.scene, this.camera);
    },
  };
  return game;
}

const canvas = document.getElementById('game');
const game = createGame(canvas);
window.__game = game;
window.__shotReady = false;

function runShot(name) {
  const scene = stageShot(name, game);
  if (scene.screen === 'title') {
    game.hud.showScreen('title');
    game.hud.hideHud();
  } else {
    game.hud.hideScreens();
    game.hud.showHud();
    // Snap the chase camera onto the player: staged shots paint only a few
    // frames, so the eased follow would never arrive.
    const p = game.player;
    const v = p.vehicle;
    game.rig.snapFollow(v ? v.x : p.x, v ? v.z : p.z, v ? v.heading : p.heading, !!v);
  }
  let painted = 0;
  function paint() {
    game.paint();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const status = document.getElementById('status');
  if (game.saved) {
    game.hud.setSaveNote(`Save found: $${Math.floor(game.saved.money || 0)}, ${game.saved.missionsDone || 0}/5 jobs done — saved ${new Date(game.saved.savedAt).toLocaleString()}.`);
    const btn = document.getElementById('continue-btn');
    btn.style.display = 'inline-block';
    btn.addEventListener('click', () => { game.audio.ensure(); game.startGame(true); });
  }
  document.getElementById('start-btn').addEventListener('click', () => { game.audio.ensure(); game.startGame(false); });
  document.getElementById('resume-btn').addEventListener('click', () => game.resumeGame());
  document.getElementById('retry-btn').addEventListener('click', () => game.respawn());
  document.getElementById('busted-btn').addEventListener('click', () => game.respawn());
  game.hud.hideHud();
  game.hud.showScreen('title');
  game.hud.announce('SOLMAR BAY. Press Enter or click Start.');
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Only consume edge actions here off the play screen: while playing, step()
    // owns them (E / Space / F would otherwise be eaten before step sees them).
    if (game.screen !== 'play') {
      const actions = game.input.takeActions();
      if (game.screen === 'title' && (actions & ACTION_CONFIRM)) { game.audio.ensure(); game.startGame(false); }
      else if ((game.screen === 'wasted' || game.screen === 'busted') && (actions & ACTION_CONFIRM)) game.respawn();
      else if (game.screen === 'pause' && (actions & ACTION_PAUSE)) game.resumeGame();
    }
    while (accumulator >= STEP && (game.screen === 'title' || game.screen === 'play')) {
      game.step(STEP);
      accumulator -= STEP;
    }
    if (game.screen === 'pause' || game.screen === 'wasted' || game.screen === 'busted') accumulator = 0;
    game.paint();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') game.pauseGame();
  });
  requestAnimationFrame(frame);
}

// Boot: let the renderer warm up (cold swiftshader compiles shaders on the
// first frames), then start whatever mode the URL asked for.
setTimeout(() => {
  const shot = params.get('shot');
  if (params.get('selftest') === '1') {
    runSelfTest(game).catch((e) => {
      console.error('SELFTEST CRASH', e);
      window.__selftest = { passed: 0, failed: 12, crashed: String(e), checks: [] };
    });
  } else if (shot) {
    runShot(shot);
  } else {
    runGame();
  }
}, BOOT_DELAY_MS);
