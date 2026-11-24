// SOLMAR BAY — the five story jobs from config.js, driven as a small state
// machine: each mission is a list of steps, each step is one verb — steal a
// car, reach a place, cool off, lose a chase. The board owns the marker
// position the beacon follows, pays out on completion, and auto-starts the
// next job so the story never stalls.

import { CONFIG, MISSIONS } from './config.js';
import { clamp } from './random.js';

const REACH_RADIUS = 13;
const STEAL_RADIUS = 60;

export function createMissions(vehicles) {
  const board = {
    index: 0,
    stepIndex: 0,
    active: false,
    done: [],
    chased: false,
    heatPrimed: false,
    lastPlayerX: 0,
    lastPlayerZ: 120,
    completedCount: 0,

    applySave(doneList, idx) {
      board.done = Array.isArray(doneList) ? doneList.slice() : [];
      board.index = clamp(idx | 0, 0, MISSIONS.length);
      board.stepIndex = 0;
      board.active = false;
      board.chased = false;
      board.heatPrimed = false;
      board.completedCount = board.done.length;
    },

    reset() {
      board.applySave([], 0);
    },

    currentDef() {
      return board.index < MISSIONS.length ? MISSIONS[board.index] : null;
    },

    stepDef() {
      const def = board.currentDef();
      if (!def) return null;
      return def.steps[board.stepIndex] || null;
    },

    start() {
      if (!board.currentDef()) return false;
      board.active = true;
      board.stepIndex = 0;
      board.chased = false;
      board.heatPrimed = false;
      return true;
    },

    // Where the beacon should point right now, or null when the current step
    // has no place (cooling off, losing a chase). For a steal step the marker
    // tracks the nearest parked car to the player.
    markerPos() {
      const step = board.stepDef();
      if (!board.active || !step) return null;
      if (step.kind === 'reach') return { x: step.at[0], z: step.at[1] };
      if (step.kind === 'steal') {
        const car = vehicles.nearestCar(board.lastPlayerX, board.lastPlayerZ, STEAL_RADIUS, true);
        if (car) return { x: car.x, z: car.z };
        // Fall back to the first parked car if none is close.
        if (vehicles.parked.length > 0) {
          const first = vehicles.parked[0];
          return { x: first.x, z: first.z };
        }
        return null;
      }
      return null;
    },

    // One-line objective text for the HUD: "2/3 — Reach the crew downtown".
    objectiveText() {
      const def = board.currentDef();
      const step = board.stepDef();
      if (!board.active || !def || !step) return board.done.length >= MISSIONS.length ? 'All jobs done — Solmar Bay is yours.' : 'No active job.';
      return `${board.stepIndex + 1}/${def.steps.length} — ${step.text}`;
    },

    update(ctx, dt) {
      void dt;
      if (!board.active) return;
      const def = board.currentDef();
      const step = board.stepDef();
      if (!def || !step) return;
      const player = ctx.player;
      board.lastPlayerX = player.inCar ? player.inCar.x : player.x;
      board.lastPlayerZ = player.inCar ? player.inCar.z : player.z;
      const px = board.lastPlayerX;
      const pz = board.lastPlayerZ;

      let done = false;
      if (step.kind === 'steal') {
        done = !!player.inCar;
      } else if (step.kind === 'reach') {
        const dx = px - step.at[0];
        const dz = pz - step.at[1];
        done = dx * dx + dz * dz < REACH_RADIUS * REACH_RADIUS;
      } else if (step.kind === 'cooldown') {
        done = ctx.wanted.stars === 0;
      } else if (step.kind === 'chase') {
        // The job starts hot: heat is primed once, then the step clears when
        // the player has been chased and shakes it off.
        if (!board.heatPrimed) {
          ctx.wanted.addHeat(2.2);
          board.heatPrimed = true;
        }
        if (ctx.wanted.stars > 0) board.chased = true;
        done = board.chased && ctx.wanted.stars === 0;
      }

      if (!done) return;
      board.stepIndex++;
      if (ctx.audio) ctx.audio.blip();
      if (board.stepIndex >= def.steps.length) {
        // Mission complete: pay out and roll into the next job.
        board.done.push(def.id);
        board.completedCount = board.done.length;
        ctx.money = (ctx.money || 0) + def.reward;
        if (ctx.audio) ctx.audio.cash();
        if (ctx.hud) ctx.hud.toast(`${def.name} complete — +$${def.reward}`);
        board.index++;
        board.stepIndex = 0;
        board.chased = false;
        board.heatPrimed = false;
        if (board.index >= MISSIONS.length) {
          board.active = false;
          if (ctx.hud) {
            ctx.hud.showCenter('ALL MISSIONS COMPLETE');
            ctx.hud.toast('Solmar Bay is yours, Vic. Every job done.');
          }
          if (ctx.onAllMissionsDone) ctx.onAllMissionsDone();
        } else if (ctx.hud) {
          const next = MISSIONS[board.index];
          ctx.hud.toast(`New job: ${next.name} — ${next.giver}: ${next.brief}`);
        }
      } else if (ctx.hud) {
        const nextStep = board.stepDef();
        if (nextStep) ctx.hud.toast(nextStep.text);
      }
    },

    // Progress for the save file and the menu ("3 of 5 jobs done").
    progress() {
      return { done: board.done.slice(), index: board.index, total: MISSIONS.length };
    },

    // How much the player has earned from jobs so far (for the stats screen).
    earnedSoFar() {
      let sum = 0;
      for (const id of board.done) {
        const def = MISSIONS.find((m) => m.id === id);
        if (def) sum += def.reward;
      }
      return sum;
    },
  };
  return board;
}

// Standalone helper the HUD uses to draw the mission list on the pause screen.
export function missionSummaries() {
  return MISSIONS.map((m) => ({
    id: m.id,
    name: m.name,
    giver: m.giver,
    brief: m.brief,
    reward: m.reward,
    steps: m.steps.length,
  }));
}

export { CONFIG };
