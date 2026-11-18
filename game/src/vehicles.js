// Cars: the player's ride, 12 traffic cars and police cruisers.
// Arcade physics for the player; lane-following AI for traffic; pursuit AI for police.
import * as THREE from 'three';
import { CAR, PALETTE, TRAFFIC_COUNT, roadCenter, clamp, angLerp } from './config.js';
import { collideCircle } from './city.js';

function carMesh(color, police) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2530 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.62; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.3, -0.2); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const x of [-0.7, 0.7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    l.position.set(x, 0.7, 2.22); g.add(l);
  }
  let barL = null;
  let barR = null;
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.72, -0.2); g.add(bar);
    barL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    barL.position.set(-0.35, 1.74, -0.2); g.add(barL);
    barR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    barR.position.set(0.35, 1.74, -0.2); g.add(barR);
  }
  return { group: g, wheels, barL, barR };
}

export class Vehicle {
  constructor(scene, x, z, heading, color, police = false) {
    this.scene = scene;
    this.police = police;
    this.color = color;
    const m = carMesh(color, police);
    this.group = m.group; this.wheels = m.wheels; this.barL = m.barL; this.barR = m.barR;
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.steer = 0;
    this.ai = null; // traffic: {axis, dir, lane, target}
    this.flash = 0;
    scene.add(this.group);
    this.sync();
  }
  get pos() { return { x: this.x, z: this.z }; }
  sync() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }
  forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }
  // Arcade drive step. `drive` = {throttle -1..1, steer -1..1}.
  driveStep(dt, drive, colliders, half, others) {
    const f = this.forward();
    this.steer = angLerp(this.steer, drive.steer, Math.min(1, dt * 8));
    const maxF = CAR.maxSpeed;
    const maxR = CAR.maxReverse;
    if (drive.throttle > 0) this.speed += CAR.accel * drive.throttle * dt;
    else if (drive.throttle < 0) this.speed += CAR.brake * drive.throttle * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    this.speed = clamp(this.speed, -maxR, maxF);
    const moving = clamp(this.speed / 8, -1, 1);
    this.heading += this.steer * CAR.steer * moving * dt;
    const nf = this.forward();
    let nx = this.x + nf.x * this.speed * dt;
    let nz = this.z + nf.z * this.speed * dt;
    nx = clamp(nx, -half - 8, half + 8);
    nz = clamp(nz, -half - 8, half + 34); // the pier end is drivable beach, not beyond
    const hit = collideCircle(colliders, nx, nz, 1.9);
    if (hit.x !== nx || hit.z !== nz) this.speed *= 0.4;
    this.x = hit.x; this.z = hit.z;
    // Soft push against other cars.
    for (const o of others) {
      if (o === this) continue;
      const dx = this.x - o.x;
      const dz = this.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        this.x += (dx / d) * push; this.z += (dz / d) * push;
        o.x -= (dx / d) * push; o.z -= (dz / d) * push;
        this.speed *= 0.85; o.speed *= 0.85;
      }
    }
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2.4;
    this.sync();
  }
  // Traffic AI: follow one road line, turn at intersections sometimes, slow for the car ahead.
  aiStep(dt, rng, colliders, half, others) {
    const a = this.ai;
    if (!a) return;
    let ahead = Infinity;
    for (const o of others) {
      if (o === this || !o.ai) continue;
      if (o.ai.axis !== a.axis || o.ai.dir !== a.dir) continue;
      const along = a.axis === 'x' ? (o.x - this.x) * a.dir : (o.z - this.z) * a.dir;
      const side = a.axis === 'x' ? Math.abs(o.z - this.z) : Math.abs(o.x - this.x);
      if (along > 0 && along < ahead && side < 4) ahead = along;
    }
    const target = ahead < 10 ? 0 : a.cruise;
    this.speed += clamp(target - this.speed, -10 * dt, 6 * dt);
    // Steer toward the lane line.
    const lanePos = a.axis === 'x' ? this.z : this.x;
    const err = a.lane - lanePos;
    const wantHeading = a.axis === 'x' ? (a.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (a.dir > 0 ? 0 : Math.PI);
    let dh = wantHeading - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += clamp(dh + err * 0.06, -1, 1) * dt * 1.4;
    const f = this.forward();
    let nx = this.x + f.x * this.speed * dt;
    let nz = this.z + f.z * this.speed * dt;
    // At a road end or an intersection, sometimes turn onto the crossing road.
    const edge = half - 4;
    const past = a.axis === 'x' ? Math.abs(nx) > edge : Math.abs(nz) > edge;
    const nearCross = Math.abs(((a.axis === 'x' ? nx : nz) % 74 + 74) % 74 - 37) < 3 && rng.chance(0.004);
    if (past || nearCross) {
      const roads = roadCenter;
      const cross = roads(Math.floor(rng.range(0, 7)));
      if (a.axis === 'x') {
        this.ai = { axis: 'z', dir: rng.chance(0.5) ? 1 : -1, lane: cross + (rng.chance(0.5) ? 3.2 : -3.2), cruise: rng.range(8, 12) };
        this.z = cross + (rng.chance(0.5) ? 3.2 : -3.2);
      } else {
        this.ai = { axis: 'x', dir: rng.chance(0.5) ? 1 : -1, lane: cross + (rng.chance(0.5) ? 3.2 : -3.2), cruise: rng.range(8, 12) };
        this.x = cross + (rng.chance(0.5) ? 3.2 : -3.2);
      }
      this.speed = Math.max(4, this.speed * 0.6);
    } else {
      const hit = collideCircle(colliders, nx, nz, 1.9);
      this.x = hit.x; this.z = hit.z;
    }
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2.4;
    this.sync();
  }
  // Police pursuit: steer at the target, faster than traffic, lights flashing.
  chaseStep(dt, tx, tz, colliders, half, others) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const want = Math.atan2(dx, dz);
    let dh = want - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += clamp(dh * 2.2, -1.6, 1.6) * dt;
    this.speed += clamp(36 - this.speed, -14 * dt, 10 * dt);
    const f = this.forward();
    let nx = this.x + f.x * this.speed * dt;
    let nz = this.z + f.z * this.speed * dt;
    nx = clamp(nx, -half - 8, half + 8);
    nz = clamp(nz, -half - 8, half + 34);
    const hit = collideCircle(colliders, nx, nz, 1.9);
    if (hit.x !== nx || hit.z !== nz) this.speed *= 0.5;
    this.x = hit.x; this.z = hit.z;
    for (const o of others) {
      if (o === this) continue;
      const ox = this.x - o.x;
      const oz = this.z - o.z;
      const d = Math.hypot(ox, oz);
      if (d < 3.4 && d > 0.01) { this.x += (ox / d) * 0.4; this.z += (oz / d) * 0.4; this.speed *= 0.9; }
    }
    this.flash += dt * 8;
    const on = Math.sin(this.flash) > 0;
    if (this.barL) this.barL.visible = on;
    if (this.barR) this.barR.visible = !on;
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2.4;
    this.sync();
  }
  remove() { this.scene.remove(this.group); }
}

export function spawnTraffic(scene, rng, half) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const line = roadCenter(rng.int(0, 6));
    const lane = line + (rng.chance(0.5) ? 3.2 : -3.2);
    const along = rng.range(-half + 20, half - 20);
    const dir = rng.chance(0.5) ? 1 : -1;
    const x = axis === 'x' ? along : lane;
    const z = axis === 'x' ? lane : along;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const v = new Vehicle(scene, x, z, heading, rng.pick(PALETTE.car));
    v.ai = { axis, dir, lane, cruise: rng.range(8, 12) };
    v.speed = v.ai.cruise;
    cars.push(v);
  }
  return cars;
}

export function nearestVehicle(vehicles, x, z, maxD) {
  let best = null;
  let bestD = maxD;
  for (const v of vehicles) {
    const d = Math.hypot(v.x - x, v.z - z);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}
