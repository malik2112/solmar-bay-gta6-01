// Wanted 0-5 stars. Crimes add heat; heat decays when you behave; police cruisers
// and foot cops chase you while the heat is on. Busted = ride back to the garage.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { Vehicle } from './vehicles.js';

export class Wanted {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.level = 0;
    this.heat = 0;
    this.policeCars = [];
    this.footCops = [];
    this.noPoliceTimer = 0;
    this.bustedTimer = 0;
    this.busted = false;
    this.sirenOn = false;
  }
  addHeat(amount) {
    this.heat = Math.min(100, this.heat + amount);
    const next = this.heat <= 0 ? 0 : this.heat <= 20 ? 1 : this.heat <= 40 ? 2 : this.heat <= 60 ? 3 : this.heat <= 80 ? 4 : 5;
    this.level = Math.min(WANTED.max, next);
  }
  decay(dt) {
    if (this.heat > 0) {
      this.heat = Math.max(0, this.heat - WANTED.decayPerSec * dt);
      if (this.heat <= 0) this.level = 0;
      else this.addHeat(0); // recompute the star count from the lower heat
    }
  }
  policeCount() { return Math.min(this.level + 1, 4); }
  update(dt, player, colliders, half, traffic, onBusted) {
    if (this.busted) return;
    // Spawn cruisers up to the level's count; remove extras when the heat drops.
    const want = this.level > 0 ? this.policeCount() : 0;
    while (this.policeCars.length < want) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(45, 70);
      const x = Math.max(-half, Math.min(half, player.x + Math.sin(a) * d));
      const z = Math.max(-half, Math.min(half, player.z + Math.cos(a) * d));
      const c = new Vehicle(this.scene, x, z, 0, 0x111111, true);
      c.speed = 12;
      this.policeCars.push(c);
    }
    while (this.policeCars.length > want) this.policeCars.pop().remove();
    // Foot cops join the chase at 2+ stars, on foot only.
    if (this.level >= 2 && !player.vehicle && this.footCops.length < 2) {
      const a = this.rng.range(0, Math.PI * 2);
      const cop = {
        x: player.x + Math.sin(a) * 18, z: player.z + Math.cos(a) * 18,
        heading: 0, shootTimer: 1, mesh: null,
      };
      const g = this.makeCopMesh();
      g.position.set(cop.x, 0, cop.z);
      this.scene.add(g);
      cop.mesh = g;
      this.footCops.push(cop);
    }
    this.sirenOn = this.level > 0;
    // Chase + busted logic.
    let nearest = Infinity;
    for (const c of this.policeCars) {
      c.chaseStep(dt, player.x, player.z, colliders, half, [...traffic, ...this.policeCars]);
      nearest = Math.min(nearest, Math.hypot(c.x - player.x, c.z - player.z));
    }
    for (const cop of this.footCops) {
      const dx = player.x - cop.x;
      const dz = player.z - cop.z;
      const d = Math.hypot(dx, dz) || 1;
      cop.heading = Math.atan2(dx, dz);
      const speed = d > 3 ? 6.5 : 0;
      cop.x += Math.sin(cop.heading) * speed * dt;
      cop.z += Math.cos(cop.heading) * speed * dt;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      nearest = Math.min(nearest, d);
      // A cop close enough shoots.
      cop.shootTimer -= dt;
      if (d < 26 && d > 2.5 && cop.shootTimer <= 0) {
        cop.shootTimer = 1.4;
        if (this.rng.chance(0.55)) player.hurt(8, player.time);
      }
      if (d < 2.2 && !player.vehicle) {
        // Caught on foot: the cop wrestles you down.
        player.hurt(12 * dt, player.time);
      }
    }
    // Busted: a cruiser sits on you while you are slow, or a cop holds you.
    const slow = player.vehicle ? Math.abs(player.vehicle.speed) < 1 : true;
    if (this.level > 0 && nearest < (player.vehicle ? 4.5 : 2.6) && slow) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 3) {
        this.busted = true;
        onBusted();
        return;
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt);
    }
    // Escape: no police near you for a while and the heat bleeds off fast.
    if (this.level > 0 && nearest > WANTED.escapeRadius) {
      this.noPoliceTimer += dt;
      if (this.noPoliceTimer > WANTED.escapeSecs) {
        this.heat = Math.max(0, this.heat - 30 * dt);
        if (this.heat <= 0) this.level = 0;
      }
    } else {
      this.noPoliceTimer = 0;
    }
  }
  makeCopMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.38), new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
    body.position.y = 1.08; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8a077 }));
    head.position.y = 1.78; g.add(head);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x0e1a30 }));
    hat.position.y = 2.0; g.add(hat);
    return g;
  }
  reset() {
    for (const c of this.policeCars) c.remove();
    this.policeCars = [];
    for (const cop of this.footCops) this.scene.remove(cop.mesh);
    this.footCops = [];
    this.level = 0; this.heat = 0;
    this.busted = false; this.bustedTimer = 0; this.noPoliceTimer = 0;
    this.sirenOn = false;
  }
}
