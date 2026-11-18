// 16 pedestrians: they stroll the sidewalks, cross at corners, and run when a
// crime happens nearby. A dead one falls over and is replaced after a while.
import * as THREE from 'three';
import { PED_COUNT, PALETTE, blockCenter, clamp } from './config.js';

function pedMesh(shirt, skin) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.72; g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x22242e });
  for (const x of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24), legMat);
    leg.position.set(x, 0.31, 0); g.add(leg);
  }
  return g;
}

const SKINS = [0xd8a077, 0xb07a52, 0x8a5a3a, 0xe8b890, 0x6a4530];

export class Ped {
  constructor(scene, rng, x, z) {
    this.scene = scene;
    this.rng = rng;
    this.mesh = pedMesh(rng.pick(PALETTE.pedShirt), rng.pick(SKINS));
    this.x = x; this.z = z;
    this.heading = rng.range(0, Math.PI * 2);
    this.speed = rng.range(1.1, 1.9);
    this.state = 'walk'; // walk | flee | dead
    this.health = 100;
    this.deadTimer = 0;
    this.respawnTimer = 0;
    this.target = this.pickTarget();
    scene.add(this.mesh);
    this.sync();
  }
  pickTarget() {
    // A sidewalk point: just off a road line, beside a block.
    const bi = this.rng.int(0, 5);
    const bj = this.rng.int(0, 5);
    const side = this.rng.int(0, 3);
    const bx = blockCenter(bi);
    const bz = blockCenter(bj);
    if (side === 0) return { x: bx + this.rng.range(-28, 28), z: bz - 33 };
    if (side === 1) return { x: bx + this.rng.range(-28, 28), z: bz + 33 };
    if (side === 2) return { x: bx - 33, z: bz + this.rng.range(-28, 28) };
    return { x: bx + 33, z: bz + this.rng.range(-28, 28) };
  }
  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }
  damage(amount, fromX, fromZ) {
    if (this.state === 'dead') return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.state = 'dead';
      this.deadTimer = 0;
      this.mesh.rotation.x = -Math.PI / 2; // fall flat
      this.mesh.position.y = 0.3;
      return true;
    }
    // Hurt: run away from the attacker.
    this.state = 'flee';
    this.fleeX = fromX; this.fleeZ = fromZ;
    return false;
  }
  scare(fromX, fromZ) {
    if (this.state !== 'walk') return;
    this.state = 'flee';
    this.fleeX = fromX; this.fleeZ = fromZ;
  }
  update(dt, half) {
    if (this.state === 'dead') {
      this.deadTimer += dt;
      if (this.deadTimer > 18) {
        // A new pedestrian takes the dead one's place across town.
        this.respawnTimer += dt;
        if (this.respawnTimer > 2) {
          const t = this.pickTarget();
          this.x = t.x; this.z = t.z;
          this.health = 100; this.state = 'walk';
          this.mesh.rotation.x = 0; this.mesh.position.y = 0;
          this.target = this.pickTarget();
          this.respawnTimer = 0;
          this.sync();
        }
      }
      return;
    }
    let tx;
    let tz;
    let speed = this.speed;
    if (this.state === 'flee') {
      const dx = this.x - this.fleeX;
      const dz = this.z - this.fleeZ;
      const d = Math.hypot(dx, dz) || 1;
      tx = this.x + (dx / d) * 30;
      tz = this.z + (dz / d) * 30;
      speed = 4.2;
      if (d > 26) { this.state = 'walk'; this.target = this.pickTarget(); }
    } else {
      tx = this.target.x; tz = this.target.z;
      if (Math.hypot(tx - this.x, tz - this.z) < 2) this.target = this.pickTarget();
    }
    const want = Math.atan2(tx - this.x, tz - this.z);
    let dh = want - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    this.x = clamp(this.x + Math.sin(this.heading) * speed * dt, -half - 4, half + 4);
    this.z = clamp(this.z + Math.cos(this.heading) * speed * dt, -half - 4, half + 4);
    // Little walk bob.
    this.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.008 + this.x)) * 0.05;
    this.sync();
  }
}

export function spawnPeds(scene, rng, half) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i++) {
    const bi = rng.int(0, 5);
    const bj = rng.int(0, 5);
    const x = blockCenter(bi) + rng.range(-28, 28);
    const z = blockCenter(bj) + (rng.chance(0.5) ? -33 : 33);
    peds.push(new Ped(scene, rng, clamp(x, -half, half), clamp(z, -half, half)));
  }
  return peds;
}
