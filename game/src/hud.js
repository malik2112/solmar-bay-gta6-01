// SOLMAR BAY — the whole 2D interface, built once as DOM on top of the
// canvas: start menu, top bar (mission / stars / cash / clock), bottom bar
// (health / stamina / ammo, speed + gear + radio), a live canvas minimap,
// crosshair, toasts, hints and the big centre messages (WASTED / BUSTED).
// update(state) is called every frame; everything else is event-driven.

import { CONFIG, CONTROLS_TEXT } from './config.js';
import { missionSummaries } from './missions.js';

const MINIMAP_SIZE = 180;
const WORLD_EXTENT = 300; // world units mapped to the minimap edge

function el(tag, id, parent, text) {
  const n = document.createElement(tag);
  if (id) n.id = id;
  if (text !== undefined && text !== null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

export function createHud(callbacks = {}) {
  const root = document.getElementById('hud');
  root.innerHTML = '';

  // -- start menu ------------------------------------------------------------
  const menu = el('div', 'menu', root);
  el('h1', null, menu, CONFIG.title);
  el('div', null, menu, CONFIG.tagline).className = 'tag';
  const story = el('div', null, menu);
  story.className = 'story';
  story.textContent =
    'Vic is out of the marina lockup with $120 and a borrowed pistol. Mara and Dario have five jobs across Solmar Bay — steal the cars, run the packages, lose the heat, and bring the gold coupe home.';
  const controls = el('div', null, menu);
  controls.className = 'controls';
  for (const line of CONTROLS_TEXT) el('span', null, controls, line);
  const startBtn = el('button', 'startBtn', menu, 'START GAME');
  const continueBtn = el('button', 'continueBtn', menu, 'CONTINUE');
  continueBtn.className = 'ghost hidden';
  const menuFine = el('div', null, menu);
  menuFine.className = 'fine';
  menuFine.textContent = 'A fan-made open-world tribute. All art, names and sound are original. Progress autosaves.';
  startBtn.addEventListener('click', () => callbacks.onStart && callbacks.onStart(false));
  continueBtn.addEventListener('click', () => callbacks.onStart && callbacks.onStart(true));

  // -- pause overlay -----------------------------------------------------------
  const pause = el('div', 'pauseMenu', root);
  pause.className = 'hidden';
  el('h2', null, pause, 'PAUSED');
  const pauseStats = el('div', 'pauseStats', pause);
  const missionList = el('div', 'missionList', pause);
  for (const m of missionSummaries()) {
    const row = el('div', null, missionList);
    row.className = 'missionRow';
    row.dataset.mission = m.id;
    el('b', null, row, `${m.name} — ${m.giver}`);
    el('span', null, row, `${m.brief} ($${m.reward})`);
  }
  const resumeBtn = el('button', 'resumeBtn', pause, 'RESUME');
  resumeBtn.addEventListener('click', () => callbacks.onResume && callbacks.onResume());
  const quitBtn = el('button', 'quitBtn', pause, 'QUIT TO MENU');
  quitBtn.className = 'ghost';
  quitBtn.addEventListener('click', () => callbacks.onQuit && callbacks.onQuit());

  // -- top bar -----------------------------------------------------------------
  const topbar = el('div', 'topbar', root);
  const missionBox = el('div', 'missionBox', topbar);
  el('b', 'missionTitle', missionBox, 'No active job');
  el('span', 'missionText', missionBox, 'Start the game to take a job.');
  const rightBox = el('div', 'rightBox', topbar);
  el('div', 'stars', rightBox, '');
  el('div', 'cash', rightBox, '$120');
  el('div', 'timeText', rightBox, '08:00');

  // -- bottom bar ---------------------------------------------------------------
  const bottombar = el('div', 'bottombar', root);
  const vitals = el('div', 'vitals', bottombar);
  const healthBar = el('div', null, vitals);
  healthBar.className = 'bar';
  const healthFill = el('i', 'healthFill', healthBar);
  el('span', 'healthText', healthBar, 'HEALTH 100');
  const staminaBar = el('div', null, vitals);
  staminaBar.className = 'bar stamina';
  const staminaFill = el('i', 'staminaFill', staminaBar);
  el('span', 'staminaText', staminaBar, 'STAMINA');
  const ammoBar = el('div', null, vitals);
  ammoBar.className = 'bar ammo';
  const ammoFill = el('i', 'ammoFill', ammoBar);
  el('span', 'ammoText', ammoBar, 'AMMO 12 / 60');

  const carBox = el('div', 'carBox', bottombar);
  el('div', 'speedText', carBox, '0');
  el('div', 'speedUnit', carBox, 'km/h');
  el('div', 'gearText', carBox, 'P');
  el('div', 'radioText', carBox, 'SOLMAR FM');

  const minimap = document.createElement('canvas');
  minimap.id = 'minimap';
  minimap.width = MINIMAP_SIZE;
  minimap.height = MINIMAP_SIZE;
  bottombar.appendChild(minimap);
  const mapCtx = minimap.getContext('2d');

  // -- floating layers ----------------------------------------------------------
  el('div', 'crosshair', root, '+');
  const toastBox = el('div', 'toast', root);
  const hintBox = el('div', 'hint', root);
  const centerMsg = el('div', 'centerMsg', root);
  const damage = el('div', 'damage', root);

  let toastTimer = null;
  let hintTimer = null;
  let centerTimer = null;
  let lastMinute = -1;

  function fmtClock(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function drawMinimap(state) {
    const S = MINIMAP_SIZE;
    const scale = S / (WORLD_EXTENT * 2);
    const toX = (x) => S / 2 + x * scale;
    const toY = (z) => S / 2 + z * scale;
    mapCtx.fillStyle = '#0e2a3a';
    mapCtx.fillRect(0, 0, S, S);
    // Sand strip + ocean at the bottom (south).
    mapCtx.fillStyle = '#e8cf9e';
    mapCtx.fillRect(0, toY(240), S, S - toY(240));
    mapCtx.fillStyle = '#1b7f9e';
    mapCtx.fillRect(0, toY(300), S, S - toY(300));
    // City ground.
    mapCtx.fillStyle = '#5d6b52';
    mapCtx.fillRect(toX(-270), toY(-270), 540 * scale, 540 * scale);
    // Roads.
    mapCtx.strokeStyle = '#33363d';
    mapCtx.lineWidth = 5;
    for (const l of state.city.roadLines) {
      mapCtx.beginPath();
      mapCtx.moveTo(toX(l), toY(-277));
      mapCtx.lineTo(toX(l), toY(277));
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(toX(-277), toY(l));
      mapCtx.lineTo(toX(277), toY(l));
      mapCtx.stroke();
    }
    // Mission marker: pulsing red diamond.
    const marker = state.missions.markerPos();
    if (marker) {
      const pulse = 4 + Math.sin(performance.now() / 280) * 2;
      mapCtx.fillStyle = '#ff5a5a';
      mapCtx.beginPath();
      mapCtx.moveTo(toX(marker.x), toY(marker.z) - pulse - 3);
      mapCtx.lineTo(toX(marker.x) + pulse + 3, toY(marker.z));
      mapCtx.lineTo(toX(marker.x), toY(marker.z) + pulse + 3);
      mapCtx.lineTo(toX(marker.x) - pulse - 3, toY(marker.z));
      mapCtx.closePath();
      mapCtx.fill();
    }
    // Traffic (white), police (flashing blue/red), peds (pale dots).
    mapCtx.fillStyle = '#eeeeee';
    for (const car of state.vehicles.traffic) {
      mapCtx.fillRect(toX(car.x) - 1.5, toY(car.z) - 1.5, 3, 3);
    }
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    mapCtx.fillStyle = flash ? '#ff2222' : '#2266ff';
    for (const cop of state.wanted.police) {
      mapCtx.beginPath();
      mapCtx.arc(toX(cop.x), toY(cop.z), 3, 0, Math.PI * 2);
      mapCtx.fill();
    }
    mapCtx.fillStyle = 'rgba(255,233,168,0.8)';
    for (const p of state.peds.peds) {
      mapCtx.fillRect(toX(p.x) - 1, toY(p.z) - 1, 2, 2);
    }
    // Player: a yellow triangle pointing along the camera yaw.
    const px = state.player.inCar ? state.player.inCar.x : state.player.x;
    const pz = state.player.inCar ? state.player.inCar.z : state.player.z;
    const yaw = state.player.camYaw;
    mapCtx.save();
    mapCtx.translate(toX(px), toY(pz));
    mapCtx.rotate(Math.PI - yaw);
    mapCtx.fillStyle = '#ffd84d';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  const hud = {
    showMenu(canContinue) {
      menu.classList.remove('hidden');
      continueBtn.classList.toggle('hidden', !canContinue);
      topbar.classList.add('hidden');
      bottombar.classList.add('hidden');
      document.getElementById('crosshair').classList.add('hidden');
      pause.classList.add('hidden');
    },
    hideMenu() {
      menu.classList.add('hidden');
      topbar.classList.remove('hidden');
      bottombar.classList.remove('hidden');
      document.getElementById('crosshair').classList.remove('hidden');
    },
    showPause(statsText) {
      pause.classList.remove('hidden');
      pauseStats.textContent = statsText || '';
      // Tick the mission list: done jobs get a check.
      const done = new Set(statsText && statsText.doneIds ? statsText.doneIds : []);
      for (const row of missionList.querySelectorAll('.missionRow')) {
        row.classList.toggle('done', done.has(row.dataset.mission));
      }
    },
    hidePause() {
      pause.classList.add('hidden');
    },
    toast(msg, ms = 3800) {
      toastBox.textContent = msg;
      toastBox.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastBox.classList.remove('show'), ms);
    },
    hint(msg, ms = 2600) {
      if (!msg) {
        hintBox.classList.remove('show');
        return;
      }
      hintBox.textContent = msg;
      hintBox.classList.add('show');
      if (hintTimer) clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hintBox.classList.remove('show'), ms);
    },
    showCenter(msg, ms = 2600) {
      centerMsg.textContent = msg;
      centerMsg.style.opacity = '1';
      if (centerTimer) clearTimeout(centerTimer);
      centerTimer = setTimeout(() => {
        centerMsg.style.opacity = '0';
      }, ms);
    },
    clearCenter() {
      centerMsg.style.opacity = '0';
      if (centerTimer) clearTimeout(centerTimer);
    },
    flashDamage() {
      damage.style.opacity = '0.55';
      setTimeout(() => {
        damage.style.opacity = '0';
      }, 220);
    },
    update(state) {
      const player = state.player;
      const def = state.missions.currentDef();
      const missionTitle = document.getElementById('missionTitle');
      const missionText = document.getElementById('missionText');
      if (state.missions.active && def) {
        missionTitle.textContent = `${def.name} — ${def.giver}  ($${def.reward})`;
        missionText.textContent = state.missions.objectiveText();
      } else if (state.missions.done.length >= 5) {
        missionTitle.textContent = 'All jobs done';
        missionText.textContent = 'Solmar Bay is yours. Free roam, Vic.';
      } else {
        missionTitle.textContent = 'Between jobs';
        missionText.textContent = 'The next job starts automatically — or press E near a car and cause trouble.';
      }
      const stars = state.wanted.stars;
      document.getElementById('stars').textContent = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
      document.getElementById('stars').style.color = stars > 0 ? '#ffd84d' : '#ffffff';
      document.getElementById('cash').textContent = `$${Math.floor(state.money).toLocaleString('en-US')}`;
      const minutes = state.dayMinutes || 480;
      if (Math.floor(minutes) !== lastMinute) {
        document.getElementById('timeText').textContent = fmtClock(minutes);
        lastMinute = Math.floor(minutes);
      }
      const hp = Math.max(0, Math.round(player.health));
      healthFill.style.width = `${hp}%`;
      healthFill.style.background = hp > 50 ? '#37c978' : hp > 25 ? '#f39c12' : '#e74c3c';
      document.getElementById('healthText').textContent = `HEALTH ${hp}`;
      const stamina = Math.round(player.stamina ?? 100);
      staminaFill.style.width = `${stamina}%`;
      document.getElementById('staminaText').textContent = stamina < 25 ? 'WINDED' : 'STAMINA';
      const mag = CONFIG.pistolAmmo;
      const ammoPct = Math.max(0, Math.min(100, (player.ammo / mag) * 100));
      ammoFill.style.width = `${ammoPct}%`;
      ammoFill.style.background = player.ammo === 0 ? '#e74c3c' : '#ffd84d';
      document.getElementById('ammoText').textContent = `AMMO ${player.ammo} / ${player.ammoReserve}`;
      const inCar = !!player.inCar;
      const speed = inCar ? Math.abs(player.inCar.speed) * 3.6 : Math.abs(player.speed) * 3.6;
      document.getElementById('speedText').textContent = String(Math.round(speed));
      let gear = 'P';
      if (inCar) gear = player.inCar.speed > 1 ? 'D' : player.inCar.speed < -1 ? 'R' : 'N';
      else if (Math.abs(player.speed) > 0.5) gear = 'WALK';
      document.getElementById('gearText').textContent = gear;
      document.getElementById('radioText').textContent = state.audio ? state.audio.stationName() : 'SOLMAR FM';
      document.getElementById('crosshair').style.opacity = state.mode === 'playing' && !inCar ? '1' : '0';
      drawMinimap(state);
    },
  };
  return hud;
}
