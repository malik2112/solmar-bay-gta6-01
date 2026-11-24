// SOLMAR BAY — cars: a box-body factory, arcade driving, traffic AI that loops
// the road grid, and police cruisers that chase. No car ever leaves the roads
// on its own; the player is the only reckless driver in Solmar Bay.

import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { makeRng, pick, clamp, lerp, wrapAngle } from './random.js';
import { roadLines } from './city.js';

export function makeCarMesh(color, kind) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 4.6), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.62, 2.3), dark);
  cabin.position.set(0, 1.28, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  if (kind === 'police') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.2, 1.2), new THREE.MeshLambertMaterial({ color: PALETTE.policeStripe }));
    stripe.position.set(0, 0.72, 0.4);
    g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: 0x223344 }));
    bar.position.set(0, 1.68, -0.25);
    g.add(bar);
    const lampR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    lampR.position.set(-0.32, 1.78, -0.25);
    g.add(lampR);
    const lampB = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    lampB.position.set(0.32, 1.78, -0.25);
    g.add(lampB);
    g.userData.lights = [lampR, lampB];
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(0, 1.72, -0.25);
    g.add(sign);
  }
  g.userData.wheels = wheels;
  return g;
}

export function createVehicleSystem(scene, city) {
  const rng = makeRng(777);
  const lines = roadLines();
  const cars = []; // every car in the world
  const traffic = []; // subset driven by AI

  function addCar(x, z, heading, kind, color, opts = {}) {
    const mesh = makeCarMesh(color ?? pick(rng, PALETTE.carPaints), kind);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      mesh,
      kind: kind || 'civil',
      x,
      z,
      heading,
      speed: 0,
      steer: 0,
      driver: opts.driver || null, // 'player' | 'ai' | 'police' | null (parked)
      parked: opts.parked === true,
      lane: opts.lane ?? 0,
      target: null,
      name: opts.name || '',
      wanted: false,
    };
    cars.push(car);
    return car;
  }

  // Parked cars the player can steal, plus a few special mission cars.
  const spots = city.parkSpots.slice();
  for (let i = 0; i < 12 && i < spots.length; i++) {
    const s = spots[(i * 7) % spots.length];
    addCar(s.x, s.z, s.heading, i === 3 ? 'taxi' : 'civil', undefined, { parked: true });
  }
  addCar(154.4, -142, 0, 'civil', 0x2471a3, { parked: true, name: 'marina-sedan' });
  addCar(-145.6, 186, 0, 'civil', 0xf1c40f, { parked: true, name: 'gold-coupe' });

  // Traffic: each car picks a road line and loops along it, turning at random.
  function spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      const along = lines[Math.floor(rng() * lines.length)];
      const cross = lines[Math.floor(rng() * lines.length)];
      const horizontal = rng() < 0.5;
      const car = addCar(
        horizontal ? cross : along,
        horizontal ? along : cross,
        horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
        rng() < 0.12 ? 'taxi' : 'civil',
        undefined,
        { driver: 'ai' },
      );
      car.speed = 9 + rng() * 6;
      car.horizontal = horizontal;
      traffic.push(car);
    }
  }
  spawnTraffic(CONFIG.trafficCount);

  function nearestCar(x, z, maxD, filter) {
    let best = null;
    let bestD = maxD;
    for (const c of cars) {
      if (filter && !filter(c)) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  function drive(car, throttle, steerInput, dt, handbrake) {
    const maxSpeed = CONFIG.carTopSpeed * (car.kind === 'police' ? 1.12 : 1);
    if (throttle > 0) car.speed += CONFIG.carAccel * throttle * dt;
    else if (throttle < 0) car.speed += CONFIG.carBrake * throttle * dt * 0.9;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 30 * dt);
    car.speed = clamp(car.speed, -14, maxSpeed);
    const steerTarget = steerInput * CONFIG.carSteer * clamp(Math.abs(car.speed) / 12, 0, 1);
    car.steer = lerp(car.steer, steerTarget, Math.min(1, dt * 6));
    // Forward is (sin h, cos h); D (steer +1) turns right, so heading falls.
    car.heading -= (car.steer * (car.speed / 14)) * dt;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // Keep cars inside the city; bounce them back at the edge.
    if (!city.insideCity(car.x, car.z)) {
      car.heading = wrapAngle(car.heading + Math.PI);
      car.speed *= 0.4;
      car.x = clamp(car.x, -city.half - 4, city.half + 4);
      car.z = clamp(car.z, -city.half - 4, city.half + 44);
    }
    const hit = city.collide(car.x, car.z, 2.4);
    car.x = hit.x;
    car.z = hit.z;
    if (hit.hit) car.speed *= 0.55;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }

  function updateTraffic(dt) {
    for (const car of traffic) {
      if (car.driver !== 'ai') continue;
      // At an intersection, sometimes turn onto the crossing road.
      const onLine = lines.some((l) => Math.abs((car.horizontal ? car.z : car.x) - l) < 1.2);
      const nearCross = lines.some((l) => Math.abs((car.horizontal ? car.x : car.z) - l) < 2.5);
      if (onLine && nearCross && rng() < dt * 0.25) {
        car.horizontal = !car.horizontal;
        car.heading = car.horizontal
          ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
          : (rng() < 0.5 ? 0 : Math.PI);
      }
      const fwd = car.horizontal ? Math.sign(Math.sin(car.heading)) : -Math.sign(Math.cos(car.heading));
      if (car.horizontal) car.x += fwd * car.speed * dt;
      else car.z += -fwd * car.speed * dt;
      if (car.x < -city.half) car.x = city.half;
      if (car.x > city.half) car.x = -city.half;
      if (car.z < -city.half) car.z = city.half;
      if (car.z > city.half + 40) car.z = -city.half;
      const hit = city.collide(car.x, car.z, 2.2);
      car.x = hit.x;
      car.z = hit.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
  }

  return {
    cars,
    traffic,
    addCar,
    nearestCar,
    drive,
    updateTraffic,
    update(dt) {
      updateTraffic(dt);
    },
  };
}
