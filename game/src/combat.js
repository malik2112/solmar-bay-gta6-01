// Combat: fists (Space) and a pistol (F / click). Hitscan shooting with a
// fading tracer; cops shoot back when close. Hurting people raises the heat.
import * as THREE from 'three';
import { PLAYER, WANTED } from './config.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.ammo = 12;
    this.ammoMax = 12;
    this.reloadTimer = 0;
    this.punchTimer = 0;
    this.tracer = null;
    this.tracerTimer = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 }));
    this.scene.add(this.tracer);
  }
  get reloading() { return this.reloadTimer > 0; }
  reload() {
    if (this.reloadTimer <= 0 && this.ammo < this.ammoMax) this.reloadTimer = 1.1;
  }
  update(dt) {
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.ammo = this.ammoMax;
    }
    if (this.punchTimer > 0) this.punchTimer -= dt;
    if (this.tracerTimer > 0) {
      this.tracerTimer -= dt;
      this.tracer.material.opacity = Math.max(0, this.tracerTimer * 4);
    }
  }
  // Punch: anything living within range and in front of the player.
  punch(player, targets, events, onCrime) {
    if (this.punchTimer > 0) return;
    this.punchTimer = 0.45;
    const f = player.forward();
    for (const t of targets) {
      if (t.state === 'dead') continue;
      const dx = t.x - player.x;
      const dz = t.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > PLAYER.punchRange || d < 0.01) continue;
      const dot = (dx * f.x + dz * f.z) / d;
      if (dot < 0.35) continue;
      const killed = t.damage(PLAYER.punchDmg, player.x, player.z);
      onCrime(killed ? WANTED.killHeat : WANTED.assaultHeat);
      events.push(killed ? 'Pedestrian down. The city saw that.' : 'You land a punch.');
      return;
    }
  }
  // Hitscan shot: nearest living target within 40 m and a narrow cone of aim.
  shoot(player, targets, events, onCrime, audio) {
    if (this.reloadTimer > 0 || this.ammo <= 0) {
      if (this.ammo <= 0) this.reload();
      return;
    }
    this.ammo -= 1;
    const f = player.forward();
    const ox = player.x;
    const oz = player.z;
    const oy = 1.5;
    let best = null;
    let bestD = 42;
    for (const t of targets) {
      if (t.state === 'dead') continue;
      const dx = t.x - ox;
      const dz = t.z - oz;
      const d = Math.hypot(dx, dz);
      if (d > bestD || d < 0.01) continue;
      const dot = (dx * f.x + dz * f.z) / d;
      if (dot < 0.92) continue;
      best = t; bestD = d;
    }
    const ex = ox + f.x * (best ? bestD : 40);
    const ez = oz + f.z * (best ? bestD : 40);
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, ox, oy, oz);
    pos.setXYZ(1, ex, 1.2, ez);
    pos.needsUpdate = true;
    this.tracer.material.opacity = 0.9;
    this.tracerTimer = 0.12;
    if (audio) audio.shot();
    if (best) {
      const killed = best.damage(34, ox, oz);
      onCrime(killed ? WANTED.killHeat : WANTED.assaultHeat);
      events.push(killed ? 'Target down.' : 'Hit!');
    }
  }
}
