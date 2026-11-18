// Five jobs from Rosa Delgado, the fixer at Rosa's Garage.
// Each mission is a chain of "reach the marker" steps; finishing one pays cash
// and unlocks the next. A beacon marks the current objective in the world.
import * as THREE from 'three';
import { MISSIONS, dist2d } from './config.js';

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.index = 0; // next mission to play
    this.state = 'idle'; // idle | active | done
    this.stepIndex = 0;
    this.timer = 0;
    this.beacon = null;
    this.completedCount = 0;
    this.failed = false;
  }
  get current() { return MISSIONS[this.index] ?? null; }
  get step() {
    const m = this.current;
    return m ? m.steps[this.stepIndex] : null;
  }
  get active() { return this.state === 'active'; }
  start() {
    if (!this.current || this.state === 'active') return false;
    this.state = 'active';
    this.stepIndex = 0;
    this.timer = this.current.timeLimit ?? 0;
    this.failed = false;
    this.showBeacon();
    return true;
  }
  showBeacon() {
    this.hideBeacon();
    const s = this.step;
    if (!s) return;
    const geo = new THREE.CylinderGeometry(2.6, 2.6, 60, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.set(s.x, 30, s.z);
    this.scene.add(this.beacon);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.4, 24), new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.x, 0.12, s.z);
    this.scene.add(ring);
    this.beaconRing = ring;
  }
  hideBeacon() {
    if (this.beacon) { this.scene.remove(this.beacon); this.beacon = null; }
    if (this.beaconRing) { this.scene.remove(this.beaconRing); this.beaconRing = null; }
  }
  // Returns 'step' | 'complete' | 'failed' | null. `events` collects toasts.
  update(dt, player, wantedLevel, events) {
    if (this.state !== 'active') return null;
    const m = this.current;
    if (m.timeLimit) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'idle';
        this.failed = true;
        this.hideBeacon();
        events.push(`Mission failed: ${m.name} — out of time. Talk to Rosa to retry.`);
        return 'failed';
      }
    }
    const s = this.step;
    if (!s) return null;
    const px = player.vehicle ? player.vehicle.x : player.x;
    const pz = player.vehicle ? player.vehicle.z : player.z;
    if (s.needClear) {
      if (wantedLevel === 0) return this.advance(events);
      return null;
    }
    if (s.needCar && !player.vehicle) return null;
    if (dist2d(px, pz, s.x, s.z) < 7) {
      if (m.id === 4 && this.stepIndex === 0) {
        events.push('Bank robbed! $1,500 in the bag — now run for the garage!');
      }
      return this.advance(events);
    }
    return null;
  }
  advance(events) {
    const m = this.current;
    this.stepIndex += 1;
    if (this.stepIndex >= m.steps.length) {
      this.state = 'done';
      this.hideBeacon();
      this.completedCount += 1;
      this.index += 1;
      events.push(`Mission complete: ${m.name} — $${m.reward} earned.`);
      return 'complete';
    }
    this.showBeacon();
    events.push(this.step.label);
    return 'step';
  }
  reset() {
    this.index = 0; this.state = 'idle'; this.stepIndex = 0;
    this.timer = 0; this.completedCount = 0; this.failed = false;
    this.hideBeacon();
  }
}
