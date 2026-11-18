// The hero on foot: WASD + Shift to run, E to steal / exit a car.
// A low-poly figure built from boxes so the game needs no art assets.
import * as THREE from 'three';
import { PLAYER, clamp } from './config.js';
import { collideCircle } from './city.js';

function heroMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6fc2 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x22242e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.38), jacket);
  body.position.y = 1.08; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
  head.position.y = 1.78; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0xc23b2e }));
  cap.position.y = 2.0; g.add(cap);
  for (const x of [-0.17, 0.17]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.26), pants);
    leg.position.set(x, 0.33, 0); g.add(leg);
  }
  for (const x of [-0.42, 0.42]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), jacket);
    arm.position.set(x, 1.1, 0); g.add(arm);
  }
  return g;
}

export class Player {
  constructor(scene, x, z) {
    this.scene = scene;
    this.mesh = heroMesh();
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = Math.PI; // face the city from the hub
    this.health = PLAYER.health;
    this.money = 0;
    this.vehicle = null;
    this.lastHurtAt = -99;
    this.time = 0;
    this.sync();
  }
  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.visible = !this.vehicle;
  }
  forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }
  hurt(amount, now) {
    this.health = Math.max(0, this.health - amount);
    this.lastHurtAt = now;
  }
  // On-foot step: camera-relative WASD (forward = away from camera yaw).
  stepOnFoot(dt, keys, camYaw, colliders, half) {
    let fx = 0;
    let fz = 0;
    if (keys.up) { fx += Math.sin(camYaw); fz += Math.cos(camYaw); }
    if (keys.down) { fx -= Math.sin(camYaw); fz -= Math.cos(camYaw); }
    if (keys.left) { fx += Math.sin(camYaw - Math.PI / 2); fz += Math.cos(camYaw - Math.PI / 2); }
    if (keys.right) { fx += Math.sin(camYaw + Math.PI / 2); fz += Math.cos(camYaw + Math.PI / 2); }
    const len = Math.hypot(fx, fz);
    if (len > 0.01) {
      const speed = keys.run ? PLAYER.run : PLAYER.walk;
      const nx = this.x + (fx / len) * speed * dt;
      const nz = this.z + (fz / len) * speed * dt;
      const want = Math.atan2(fx, fz);
      let dh = want - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += clamp(dh, -8 * dt, 8 * dt);
      const hit = collideCircle(colliders, nx, nz, PLAYER.radius);
      this.x = clamp(hit.x, -half - 8, half + 34);
      this.z = clamp(hit.z, -half - 8, half + 34);
    }
    // Slow health regen after 5 calm seconds.
    if (this.time - this.lastHurtAt > 5 && this.health > 0 && this.health < PLAYER.health) {
      this.health = Math.min(PLAYER.health, this.health + 2 * dt);
    }
    this.sync();
  }
  enterCar(vehicle) {
    this.vehicle = vehicle;
    vehicle.ai = null;
    this.sync();
  }
  exitCar() {
    if (!this.vehicle) return null;
    const v = this.vehicle;
    this.vehicle = null;
    // Step out on the driver's side.
    this.x = v.x - Math.cos(v.heading) * 2.2;
    this.z = v.z + Math.sin(v.heading) * 2.2;
    this.heading = v.heading;
    this.sync();
    return v;
  }
}
