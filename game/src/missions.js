// SOLMAR BAY — five story missions, chained in order, with a 3D beacon over
// the current objective and a step machine the main loop drives.

import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { dist2d } from './random.js';

export function createMissions(scene, city) {
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd84d,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 42, 20, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd84d, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.0, 28), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  const missions = {
    index: 0, // next mission to play
    done: [],
    active: null, // {def, step}
    beacon,
    ring,
    currentDef() {
      return MISSIONS[missions.index] || null;
    },
    isFinished() {
      return missions.index >= MISSIONS.length;
    },
    start() {
      const def = missions.currentDef();
      if (!def) return null;
      missions.active = { def, step: 0 };
      missions.showBeacon();
      return missions.active;
    },
    stepDef() {
      if (!missions.active) return null;
      return missions.active.def.steps[missions.active.step] || null;
    },
    targetPos() {
      const s = missions.stepDef();
      if (s && s.at) return { x: s.at[0], z: s.at[1] };
      return null;
    },
    showBeacon() {
      const pos = missions.targetPos();
      if (pos) {
        beacon.position.set(pos.x, 21, pos.z);
        beacon.visible = true;
        ring.position.set(pos.x, 0.15, pos.z);
        ring.visible = true;
      } else {
        beacon.visible = false;
        ring.visible = false;
      }
    },
    advance() {
      if (!missions.active) return 'none';
      missions.active.step += 1;
      if (missions.active.step >= missions.active.def.steps.length) {
        const def = missions.active.def;
        missions.done.push(def.id);
        missions.index += 1;
        missions.active = null;
        beacon.visible = false;
        ring.visible = false;
        return 'complete';
      }
      missions.showBeacon();
      return 'step';
    },
    // Called every frame with the live game state; returns an event string or null.
    update(state, dt) {
      if (!missions.active) return null;
      const s = missions.stepDef();
      if (!s) return null;
      if (dt) {
        s.elapsed = (s.elapsed || 0) + dt;
        // Anti-soft-lock: a chase step that never draws heat still moves on.
        if (s.kind === 'chase' && s.elapsed > 90) return missions.advance();
      }
      const px = state.player.inCar ? state.player.inCar.x : state.player.x;
      const pz = state.player.inCar ? state.player.inCar.z : state.player.z;
      if (s.kind === 'reach') {
        if (dist2d(px, pz, s.at[0], s.at[1]) < 7) return missions.advance();
      } else if (s.kind === 'cooldown') {
        if (state.wanted.stars === 0) return missions.advance();
      } else if (s.kind === 'chase') {
        // Step completes once the player has drawn heat and then cleared it.
        if (state.wanted.stars >= 2) s.armed = true;
        if (s.armed && state.wanted.stars === 0) return missions.advance();
      }
      // 'steal' steps advance from the car-entry event in main.js.
      return null;
    },
    onCarStolen() {
      const s = missions.stepDef();
      if (s && s.kind === 'steal') return missions.advance();
      return null;
    },
    applySave(doneList, index) {
      missions.done = doneList.slice();
      missions.index = index;
      missions.active = null;
    },
  };
  return missions;
}
