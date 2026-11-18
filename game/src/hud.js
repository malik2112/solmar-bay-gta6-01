// HUD: wanted stars, cash, health, speed, mission brief, toasts, minimap,
// title / pause / wasted / busted screens. The minimap is a 2D canvas drawn
// from the live state every frame.
import { CITY, HUB, PLACES, roadCenter, blockCenter } from './config.js';

export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    hud: $('hud'),
    stars: $('stars'), cash: $('cash'), health: $('health-fill'), healthText: $('health-text'),
    speed: $('speed'), mission: $('mission'), brief: $('brief-text'), timer: $('mission-timer'),
    toast: $('toast'), map: $('minimap'), title: $('title-screen'), pause: $('pause-screen'),
    wasted: $('wasted-screen'), busted: $('busted-screen'), status: $('status'),
    saveNote: $('save-note'), continueBtn: $('continue-btn'),
  };
  const mapCtx = el.map.getContext('2d');
  let toastTimer = 0;

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.style.opacity = '1';
    toastTimer = 4;
  }
  function drawMinimap(state) {
    const S = 180;
    const span = CITY.span + 60;
    const toMap = (x, z) => [((x + span / 2) / span) * S, ((z + span / 2) / span) * S];
    mapCtx.fillStyle = '#101018';
    mapCtx.fillRect(0, 0, S, S);
    // Bay water at the bottom (south).
    mapCtx.fillStyle = '#14506e';
    const [, wy] = toMap(0, CITY.span / 2);
    mapCtx.fillRect(0, wy, S, S - wy);
    // Blocks.
    mapCtx.fillStyle = '#3a3a44';
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const [x, y] = toMap(blockCenter(i) - 30, blockCenter(j) - 30);
        mapCtx.fillRect(x, y, (60 / span) * S, (60 / span) * S);
      }
    }
    // Roads.
    mapCtx.strokeStyle = '#5a5a66';
    mapCtx.lineWidth = (14 / span) * S;
    for (let k = 0; k <= 6; k++) {
      const [x] = toMap(roadCenter(k), 0);
      mapCtx.beginPath(); mapCtx.moveTo(x, 0); mapCtx.lineTo(x, S); mapCtx.stroke();
      const [, y] = toMap(0, roadCenter(k));
      mapCtx.beginPath(); mapCtx.moveTo(0, y); mapCtx.lineTo(S, y); mapCtx.stroke();
    }
    // Places.
    mapCtx.fillStyle = '#ffd23e';
    for (const p of [HUB, PLACES.pier, PLACES.bank, PLACES.marina, PLACES.safehouse]) {
      const [x, y] = toMap(p.x, p.z);
      mapCtx.fillRect(x - 2, y - 2, 4, 4);
    }
    // Mission beacon.
    if (state.missions.active && state.missions.step) {
      const [x, y] = toMap(state.missions.step.x, state.missions.step.z);
      mapCtx.fillStyle = '#ffe14d';
      mapCtx.beginPath(); mapCtx.arc(x, y, 6 + Math.sin(state.time * 4) * 2, 0, Math.PI * 2); mapCtx.fill();
      mapCtx.strokeStyle = '#ffe14d'; mapCtx.lineWidth = 2;
      mapCtx.beginPath(); mapCtx.arc(x, y, 10, 0, Math.PI * 2); mapCtx.stroke();
    }
    // Traffic (grey), police (flashing blue/red), pedestrians (green dots).
    mapCtx.fillStyle = '#b8b8c8';
    for (const v of state.traffic) {
      const [x, y] = toMap(v.x, v.z);
      mapCtx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    const flash = Math.sin(state.time * 8) > 0;
    mapCtx.fillStyle = flash ? '#ff4444' : '#4488ff';
    for (const c of state.wanted.policeCars) {
      const [x, y] = toMap(c.x, c.z);
      mapCtx.beginPath(); mapCtx.arc(x, y, 4, 0, Math.PI * 2); mapCtx.fill();
    }
    mapCtx.fillStyle = '#5ae08a';
    for (const p of state.peds) {
      if (p.state === 'dead') continue;
      const [x, y] = toMap(p.x, p.z);
      mapCtx.fillRect(x - 1, y - 1, 2, 2);
    }
    // Player arrow.
    const px = state.player.vehicle ? state.player.vehicle.x : state.player.x;
    const pz = state.player.vehicle ? state.player.vehicle.z : state.player.z;
    const heading = state.player.vehicle ? state.player.vehicle.heading : state.player.heading;
    const [mx, my] = toMap(px, pz);
    mapCtx.save();
    mapCtx.translate(mx, my);
    mapCtx.rotate(-heading + Math.PI);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath(); mapCtx.moveTo(0, -7); mapCtx.lineTo(5, 6); mapCtx.lineTo(-5, 6); mapCtx.closePath(); mapCtx.fill();
    mapCtx.restore();
  }

  return {
    el,
    showToast,
    showHud() { el.hud.style.display = 'block'; },
    hideHud() { el.hud.style.display = 'none'; },
    showScreen(name) {
      for (const [key, node] of [['title', el.title], ['pause', el.pause], ['wasted', el.wasted], ['busted', el.busted]]) {
        node.style.display = key === name ? 'flex' : 'none';
      }
    },
    hideScreens() {
      for (const node of [el.title, el.pause, el.wasted, el.busted]) node.style.display = 'none';
    },
    announce(msg) { el.status.textContent = msg; },
    setSaveNote(text) { el.saveNote.textContent = text; },
    update(state, dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) el.toast.style.opacity = '0';
      }
      // Stars.
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < state.wanted.level ? '★' : '☆';
      el.stars.textContent = stars;
      el.stars.style.color = state.wanted.level > 0 ? '#ffd23e' : '#8b93a3';
      el.stars.classList.toggle('flash', state.wanted.level >= 3);
      el.cash.textContent = `$${Math.floor(state.player.money).toLocaleString('en-US')}`;
      el.health.style.width = `${Math.max(0, state.player.health)}%`;
      el.health.style.background = state.player.health > 50 ? '#3aa655' : state.player.health > 25 ? '#e8c832' : '#c23b2e';
      el.healthText.textContent = `${Math.ceil(state.player.health)} HP`;
      const speed = state.player.vehicle ? Math.abs(state.player.vehicle.speed) * 3.6 : 0;
      el.speed.textContent = state.player.vehicle ? `${Math.round(speed)} km/h` : 'ON FOOT';
      if (state.missions.active) {
        const m = state.missions.current;
        el.mission.style.display = 'block';
        el.brief.textContent = `${m.name} — ${state.missions.step ? state.missions.step.label : ''}`;
        el.timer.textContent = m.timeLimit ? `⏱ ${Math.max(0, Math.ceil(state.missions.timer))}s` : '';
      } else if (state.missions.current) {
        el.mission.style.display = 'block';
        const m = state.missions.current;
        el.brief.textContent = `Next job: ${m.name} — press M to talk to Rosa`;
        el.timer.textContent = state.missions.completedCount > 0 ? `${state.missions.completedCount}/5 done` : '';
      } else {
        el.mission.style.display = 'block';
        el.brief.textContent = 'All 5 jobs done. Solmar Bay is yours — free roam!';
        el.timer.textContent = '★ 5/5';
      }
      drawMinimap(state);
    },
  };
}
