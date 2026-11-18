// In-game self-test (?selftest=1): 12 checks that drive the real game — spawn,
// city, traffic, pedestrians, stealing, driving, wanted, missions, combat,
// save and HUD. Results land in window.__selftest and the console as
// `SELFTEST <name> PASS|FAIL <detail>`. The drive check POLLS until the car
// has moved > 5 m (cold swiftshader makes a fixed 2 s wait meaningless).
import { STEP, TRAFFIC_COUNT, PED_COUNT, HUB, WANTED, roadCenter, dist2d } from './config.js';
import { saveGame, loadGame } from './save.js';

function pressKey(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

async function stepFor(game, seconds) {
  const n = Math.max(1, Math.round(seconds / STEP));
  for (let i = 0; i < n; i++) {
    game.step(STEP);
    if (i % 60 === 59) await new Promise((r) => setTimeout(r, 0));
  }
}

export async function runSelfTest(game) {
  const checks = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok: !!ok, detail: String(detail ?? '') });
    console.log(`SELFTEST ${name} ${ok ? 'PASS' : 'FAIL'} ${detail ?? ''}`);
  };
  // Small render target while testing: swiftshader at 1280x720 is slow, and
  // the checks step the simulation directly, not the renderer.
  try { game.renderer.setSize(640, 360, false); } catch { /* ignore */ }
  game.screen = 'play';
  game.hud.hideScreens();
  await new Promise((r) => setTimeout(r, 50));

  try {
    // 1. Boot.
    check('boot', game.scene && game.renderer && game.camera && game.city,
      `scene=${!!game.scene} renderer=${!!game.renderer}`);
  } catch (e) { check('boot', false, e.message); }

  try {
    // 2. City: 6x6 blocks of colliders, 7 road lines each way.
    const blocks = game.city.colliders.length;
    check('city', blocks >= 50 && game.city.roadLines.length === 7,
      `colliders=${blocks} roadLines=${game.city.roadLines.length}`);
  } catch (e) { check('city', false, e.message); }

  try {
    // 3. Player spawns on foot near Rosa's Garage, full health.
    const d = dist2d(game.player.x, game.player.z, HUB.x, HUB.z);
    check('spawn', !game.player.vehicle && d < 20 && game.player.health === 100,
      `distToHub=${d.toFixed(1)}m health=${game.player.health}`);
  } catch (e) { check('spawn', false, e.message); }

  try {
    // 4. Traffic: exactly 12 cars, on the roads.
    const roads = game.city.roadLines;
    const near = (v) => roads.some((r) => Math.abs(v.x - r) < 10 || Math.abs(v.z - r) < 10);
    const onRoad = game.traffic.filter(near).length;
    check('traffic', game.traffic.length === TRAFFIC_COUNT && onRoad >= 10,
      `cars=${game.traffic.length} onRoad=${onRoad}/12`);
  } catch (e) { check('traffic', false, e.message); }

  try {
    // 5. Pedestrians: exactly 16, alive.
    const alive = game.peds.filter((p) => p.state !== 'dead').length;
    check('peds', game.peds.length === PED_COUNT && alive === PED_COUNT,
      `peds=${game.peds.length} alive=${alive}`);
  } catch (e) { check('peds', false, e.message); }

  try {
    // 6. Steal: stand by a traffic car, press E, end up driving it.
    const car = game.traffic[0];
    game.player.x = car.x + 2; game.player.z = car.z + 2;
    game.player.sync();
    pressKey('KeyE');
    await stepFor(game, 0.5);
    check('enter-car', game.player.vehicle === car, `driving=${!!game.player.vehicle}`);
  } catch (e) { check('enter-car', false, e.message); }

  try {
    // 7. Drive: hold W and POLL until the car has moved > 5 m (max 12 s wall).
    const v = game.player.vehicle;
    const sx = v.x; const sz = v.z;
    game.input.virtual = { up: true };
    let moved = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 12000) {
      await stepFor(game, 0.25);
      moved = dist2d(sx, sz, v.x, v.z);
      if (moved > 5) break;
    }
    game.input.virtual = null;
    check('drive', moved > 5, `moved=${moved.toFixed(1)}m in ${((Date.now() - t0) / 1000).toFixed(1)}s speed=${v.speed.toFixed(1)}m/s`);
  } catch (e) { game.input.virtual = null; check('drive', false, e.message); }

  try {
    // 8. Wanted: stealing raised the heat; cruisers arrive to chase.
    await stepFor(game, 2);
    check('wanted', game.wanted.level >= 1 && game.wanted.policeCars.length >= 1,
      `stars=${game.wanted.level} cruisers=${game.wanted.policeCars.length}`);
  } catch (e) { check('wanted', false, e.message); }

  try {
    // 9. Mission: Rosa's first job starts, and driving the stolen car to the
    // garage completes it.
    game.talkToRosa();
    const started = game.missions.active && game.missions.step;
    const v = game.player.vehicle;
    v.x = HUB.x + 3; v.z = HUB.z + 3; v.speed = 0; v.sync();
    await stepFor(game, 1);
    check('mission', started && game.missions.completedCount === 1,
      `started=${!!started} done=${game.missions.completedCount}`);
  } catch (e) { check('mission', false, e.message); }

  try {
    // 10. Combat: step out, put a pedestrian in front of you, punch them.
    pressKey('KeyE');
    await stepFor(game, 0.5);
    const ped = game.peds.find((p) => p.state !== 'dead');
    const f = game.player.forward();
    ped.x = game.player.x + f.x * 1.5;
    ped.z = game.player.z + f.z * 1.5;
    ped.sync();
    const hpBefore = ped.health;
    pressKey('Space');
    await stepFor(game, 0.6);
    check('combat', ped.health < hpBefore || ped.state === 'dead',
      `hp ${hpBefore} -> ${ped.health} state=${ped.state}`);
  } catch (e) { check('combat', false, e.message); }

  try {
    // 11. Save: money survives a round trip through localStorage.
    game.player.money = 1234;
    saveGame(game);
    const back = loadGame();
    check('save', back && back.money === 1234, `loadedMoney=${back ? back.money : 'null'}`);
  } catch (e) { check('save', false, e.message); }

  try {
    // 12. HUD: stars, cash, health, minimap all present; the minimap has ink.
    game.hud.update(game, 0);
    const map = game.hud.el.map;
    const ctx = map.getContext('2d');
    const data = ctx.getImageData(0, 0, map.width, map.height).data;
    let varied = 0;
    for (let i = 0; i < data.length; i += 401 * 4) {
      if (data[i] !== 16 || data[i + 1] !== 16) varied += 1;
    }
    check('hud', game.hud.el.stars && game.hud.el.cash && game.hud.el.health && varied > 3,
      `minimapVariedSamples=${varied}`);
  } catch (e) { check('hud', false, e.message); }

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.length - passed;
  window.__selftest = { passed, failed, total: checks.length, checks };
  document.title = `SELFTEST ${passed}/${checks.length}`;
  console.log(`SELFTEST DONE ${passed}/${checks.length}`);
  // One real frame so a screenshot of the tested state is possible.
  try { game.paint(); } catch { /* ignore */ }
}
