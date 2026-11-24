// SOLMAR BAY — the whole DOM interface: start menu, HUD bars, wanted stars,
// cash, mission tracker, radio/speed readout, toasts, and the 2D minimap.

import { CONFIG, CONTROLS_TEXT, MISSIONS } from './config.js';

export function createHud(ctx) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="menu" class="panel">
      <h1>SOLMAR BAY</h1>
      <p class="tag">A sun-soaked open-world crime story — built for the browser.</p>
      <p class="story">You are Vic, fresh out of the marina lockup with $120 and a borrowed
      pistol. Mara and Dario have five jobs for you. Steal the cars, dodge the
      Solmar Bay PD, and take the final score home.</p>
      <div class="controls">${CONTROLS_TEXT.map((c) => `<div>${c}</div>`).join('')}</div>
      <button id="playBtn">START — Play Solmar Bay</button>
      <button id="continueBtn" class="ghost">Continue saved game</button>
      <p class="fine">Progress saves automatically. Missions: ${MISSIONS.length} · Free to play, no account.</p>
    </div>
    <div id="topbar">
      <div id="missionBox"><b id="missionName">—</b><span id="missionText">—</span></div>
      <div id="rightBox">
        <div id="stars">☆☆☆☆☆</div>
        <div id="cash">$0</div>
      </div>
    </div>
    <div id="bottombar">
      <div id="vitals">
        <div class="bar"><i id="hpFill"></i><span>HEALTH</span></div>
        <div class="bar ammo"><i id="ammoFill"></i><span id="ammoText">AMMO</span></div>
      </div>
      <div id="carBox"><span id="speedText">0 mph</span><span id="radioText">—</span></div>
      <canvas id="minimap" width="180" height="180"></canvas>
    </div>
    <div id="crosshair">+</div>
    <div id="toast"></div>
    <div id="centerMsg" class="hidden"></div>
    <div id="hint">Press E to enter a car</div>
  `;

  const el = (id) => document.getElementById(id);
  const map = el('minimap').getContext('2d');
  let toastTimer = null;
  let hintTimer = null;

  const hud = {
    showMenu(hasSave) {
      el('menu').classList.remove('hidden');
      el('continueBtn').style.display = hasSave ? '' : 'none';
      el('topbar').classList.add('hidden');
      el('bottombar').classList.add('hidden');
      el('crosshair').classList.add('hidden');
    },
    hideMenu() {
      el('menu').classList.add('hidden');
      el('topbar').classList.remove('hidden');
      el('bottombar').classList.remove('hidden');
      el('crosshair').classList.remove('hidden');
    },
    onPlay(fn) {
      el('playBtn').addEventListener('click', () => fn(false));
      el('continueBtn').addEventListener('click', () => fn(true));
    },
    toast(text, ms = 3200) {
      const t = el('toast');
      t.textContent = text;
      t.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), ms);
    },
    hint(text, ms = 2600) {
      const h = el('hint');
      h.textContent = text;
      h.classList.add('show');
      if (hintTimer) clearTimeout(hintTimer);
      hintTimer = setTimeout(() => h.classList.remove('show'), ms);
    },
    center(text, ms = 2600) {
      const c = el('centerMsg');
      c.textContent = text;
      c.classList.remove('hidden');
      setTimeout(() => c.classList.add('hidden'), ms);
    },
    update(state) {
      const stars = '★'.repeat(state.wanted.stars) + '☆'.repeat(5 - state.wanted.stars);
      el('stars').textContent = stars;
      el('stars').style.color = state.wanted.stars > 0 ? '#ff5a5a' : '#ffffff';
      el('cash').textContent = `$${Math.round(state.money).toLocaleString('en-US')}`;
      el('hpFill').style.width = `${Math.max(0, state.player.health)}%`;
      el('hpFill').style.background = state.player.health > 50 ? '#37c978' : state.player.health > 25 ? '#f1c40f' : '#e74c3c';
      el('ammoText').textContent = `AMMO ${state.player.ammo} / ${state.player.ammoReserve}`;
      el('ammoFill').style.width = `${(state.player.ammo / CONFIG.pistolAmmo) * 100}%`;
      const speed = state.player.inCar ? Math.round(Math.abs(state.player.inCar.speed) * 2.2) : 0;
      el('speedText').textContent = state.player.inCar ? `${speed} mph` : 'ON FOOT';
      el('radioText').textContent = state.audio.stationName();
      const def = state.missions.active ? state.missions.active.def : state.missions.currentDef();
      if (state.missions.isFinished()) {
        el('missionName').textContent = 'ALL MISSIONS COMPLETE';
        el('missionText').textContent = 'Solmar Bay is yours. Free roam — cause trouble, or don’t.';
      } else if (def) {
        const step = state.missions.active ? state.missions.stepDef() : null;
        el('missionName').textContent = `MISSION ${state.missions.index + 1}/${MISSIONS.length} — ${def.name} (${def.giver})`;
        el('missionText').textContent = state.missions.active
          ? step.text
          : def.brief;
        if (state.missions.active && step && step.at) {
          const px = state.player.inCar ? state.player.inCar.x : state.player.x;
          const pz = state.player.inCar ? state.player.inCar.z : state.player.z;
          const d = Math.round(Math.hypot(step.at[0] - px, step.at[1] - pz));
          el('missionText').textContent += ` · ${d}m`;
        }
      }
      hud.drawMinimap(state);
    },
    drawMinimap(state) {
      const S = 180;
      const R = CONFIG.minimapRange;
      const px = state.player.inCar ? state.player.inCar.x : state.player.x;
      const pz = state.player.inCar ? state.player.inCar.z : state.player.z;
      map.clearRect(0, 0, S, S);
      map.fillStyle = 'rgba(12, 28, 38, 0.85)';
      map.fillRect(0, 0, S, S);
      const toMap = (x, z) => [S / 2 + ((x - px) / R) * (S / 2), S / 2 + ((z - pz) / R) * (S / 2)];
      // Roads (from the city grid), buildings as blocks, beach + ocean south.
      const city = state.city;
      const lines = city.roadLines;
      map.strokeStyle = '#4a5568';
      map.lineWidth = 5;
      for (const c of lines) {
        const [ax, ay] = toMap(c, pz - R);
        const [bx, by] = toMap(c, pz + R);
        map.beginPath(); map.moveTo(ax, ay); map.lineTo(bx, by); map.stroke();
        const [cx, cy] = toMap(px - R, c);
        const [dx, dy] = toMap(px + R, c);
        map.beginPath(); map.moveTo(cx, cy); map.lineTo(dx, dy); map.stroke();
      }
      map.fillStyle = '#2f6f8f';
      const [ox, oy] = toMap(px, city.half + 20);
      map.fillRect(0, oy, S, S - oy);
      map.fillStyle = '#e8cf9e';
      const [sx, sy] = toMap(px, city.half);
      map.fillRect(0, sy - 3, S, 6);
      // Mission marker.
      const target = state.missions.targetPos();
      if (target) {
        const [mx, my] = toMap(target.x, target.z);
        map.fillStyle = '#ffd84d';
        map.beginPath(); map.arc(mx, my, 6, 0, Math.PI * 2); map.fill();
        map.strokeStyle = '#111111';
        map.lineWidth = 2;
        map.stroke();
      }
      // Police dots, traffic dots.
      for (const cop of state.wanted.police) {
        const [mx, my] = toMap(cop.x, cop.z);
        map.fillStyle = '#3b82f6';
        map.beginPath(); map.arc(mx, my, 4, 0, Math.PI * 2); map.fill();
      }
      // Player arrow.
      const heading = state.player.inCar ? state.player.inCar.heading : state.player.heading;
      map.save();
      map.translate(S / 2, S / 2);
      map.rotate(Math.PI - heading);
      map.fillStyle = '#ffffff';
      map.beginPath();
      map.moveTo(0, -8); map.lineTo(6, 7); map.lineTo(-6, 7); map.closePath();
      map.fill();
      map.restore();
      map.strokeStyle = 'rgba(255,255,255,0.6)';
      map.lineWidth = 2;
      map.strokeRect(1, 1, S - 2, S - 2);
      void ctx;
    },
  };
  return hud;
}
