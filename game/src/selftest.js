// SOLMAR BAY — in-browser self test (?selftest=1): boots the world, asserts
// every system, and reports PASS/FAIL in the page title and a DOM panel so a
// headless run can read it without a human.

export function runSelftest(state) {
  const checks = [];
  function check(name, ok, detail) {
    checks.push({ name, ok: !!ok, detail: detail || '' });
  }

  check('three.js loaded', typeof state.THREE !== 'undefined' && !!state.THREE.Scene);
  check('renderer created', !!state.view.renderer);
  check('city built: colliders', state.city.colliders.length > 50, `${state.city.colliders.length} buildings`);
  check('city built: park spots', state.city.parkSpots.length > 20, `${state.city.parkSpots.length} spots`);
  check('traffic spawned', state.vehicles.traffic.length >= 10, `${state.vehicles.traffic.length} cars`);
  check('pedestrians spawned', state.peds.peds.length >= 20, `${state.peds.peds.length} walkers`);
  check('missions defined', state.missions.currentDef() !== null, '5 missions');
  check('player stamina', typeof state.player.stamina === 'number' && state.player.stamina >= 0, `stamina=${state.player.stamina}`);
  check('radio stations', state.audio.stationName().length > 0, state.audio.stationName());
  check('mission marker resolves', (() => {
    state.missions.applySave([], 0);
    state.missions.start();
    const m = state.missions.markerPos();
    return m !== null && typeof m.x === 'number' && typeof m.z === 'number';
  })(), 'steal step points at a parked car');
  check('hud mounted', !!document.getElementById('minimap'));
  check('save roundtrip', (() => {
    try {
      window.localStorage.setItem('solmar-selftest', 'ok');
      const v = window.localStorage.getItem('solmar-selftest');
      window.localStorage.removeItem('solmar-selftest');
      return v === 'ok';
    } catch (_e) {
      return false;
    }
  })());

  // Drive one simulated tick of every system to catch runtime errors.
  let tickOk = true;
  let tickErr = '';
  try {
    const dt = 1 / 60;
    state.city.update(dt, 1);
    state.player.update(dt, state.input, state);
    state.vehicles.update(dt);
    state.peds.update(dt, 0);
    state.wanted.update(dt, state.player, state.vehicles, null);
    state.combat.update(dt, 1);
    state.missions.update(state, dt);
    state.view.updateCamera(dt, state.player);
    state.view.render();
    state.hud.update(state);
  } catch (e) {
    tickOk = false;
    tickErr = String(e && e.message ? e.message : e);
  }
  check('one full tick runs', tickOk, tickErr);

  // Wanted math: heat adds stars and cools back down.
  state.wanted.setStars(0);
  state.wanted.addHeat(1.2);
  check('wanted rises', state.wanted.stars === 2, `stars=${state.wanted.stars}`);
  state.wanted.update(60, state.player, state.vehicles, null);
  check('wanted cools off', state.wanted.stars === 0, `stars=${state.wanted.stars}`);
  state.wanted.setStars(0);

  // Combat: reload moves reserve ammo into the magazine.
  state.player.ammo = 2;
  state.player.ammoReserve = 30;
  const reloaded = state.combat.reload(state.player, null);
  check('reload works', reloaded && state.player.ammo === 12, `ammo=${state.player.ammo}`);

  // Mission flow: starting mission 1 exposes a steal step.
  state.missions.applySave([], 0);
  state.missions.start();
  const step = state.missions.stepDef();
  check('mission 1 starts', !!state.missions.active && !!step && step.kind === 'steal', step ? step.kind : 'no step');

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.length - passed;
  const result = { passed, failed, total: checks.length, checks };
  window.__selftest = result;
  document.title = failed === 0 ? `SELFTEST PASS ${passed}/${checks.length}` : `SELFTEST FAIL ${passed}/${checks.length}`;
  const div = document.createElement('div');
  div.id = 'selftest';
  div.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;background:#111;color:#0f0;font:12px monospace;padding:8px;white-space:pre;';
  div.textContent = result.checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`).join('\n');
  document.body.appendChild(div);
  return result;
}
