// SOLMAR BAY — save / load through localStorage, plain JSON, no secrets.

import { CONFIG } from './config.js';

export function defaultSave() {
  return {
    version: 1,
    money: CONFIG.startMoney,
    health: CONFIG.startHealth,
    missionsDone: [],
    missionIndex: 0,
    player: { x: 0, z: 120, heading: 0 },
    radio: 0,
    playSeconds: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(CONFIG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    const d = defaultSave();
    return {
      ...d,
      ...data,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
      player: { ...d.player, ...(data.player || {}) },
    };
  } catch (_err) {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      version: 1,
      money: Math.round(state.money),
      health: Math.round(state.health),
      missionsDone: state.missionsDone.slice(),
      missionIndex: state.missionIndex,
      player: { x: state.player.x, z: state.player.z, heading: state.player.heading },
      radio: state.radioStation,
      playSeconds: Math.round(state.playSeconds || 0),
    };
    window.localStorage.setItem(CONFIG.saveKey, JSON.stringify(data));
    return true;
  } catch (_err) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(CONFIG.saveKey);
  } catch (_err) {
    /* storage may be unavailable; the game still runs */
  }
}
