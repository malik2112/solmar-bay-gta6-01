// SOLMAR BAY — cars: mesh factory, traffic that follows the road grid, and
// arcade driving for the player. Traffic cars pick a road centreline and a
// direction, cruise it, and turn at intersections; parked cars sit on the
// spots the city laid out until somebody steals one.

import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { makeRng, pick, range, intRange, clamp, angleLerp } from './random.js';

const CAR_LENGTH = 4.3;
const CAR_WIDTH = 2.0;

// Shared geometry/materials so fifty cars cost almost nothing to build.
const bodyGeo = new THREE.BoxGeometry(CAR_WIDTH, 0.62, CAR_LENGTH);
const cabinGeo = new THREE.BoxGeometry(CAR_WIDTH - 0.35, 0.55, CAR_LENGTH * 0.48);
const glassGeo = new THREE.BoxGeometry(CAR_WIDTH - 0.3, 0.42, 0.5);
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
const lightBarGeo = new THREE.BoxGeometry(1.5, 0.22, 0.5);
const beaconGeo = new THREE.BoxGeometry(0.5, 0.26, 0.42);
const headGeo = new THREE.BoxGeometry(0.34, 0.16, 0.1);
const tailGeo = new THREE.BoxGeometry(0.34, 0.14, 0.1);
const signGeo = new THREE.BoxGeometry(0.9, 0.22, 0.5);
const stripeGeo = new THREE.BoxGeometry(CAR_WIDTH + 0.04, 0.2, CAR_LENGTH * 0.7);

const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0xcfd8dc });
const paintCache = new Map();

function paintMat(paint) {
  let m = paintCache.get(paint);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: paint });
    paintCache.set(paint, m);
  }
  return m;
}

// A low-poly car. `kind` is 'civil' | 'police' | 'taxi' | 'sport'.
// Police cars carry userData.lights = [redBeacon, blueBeacon] so the wanted
// system can flash them; the mesh also carries userData.car back to its car.
export function makeCarMesh(paint, kind = 'civil') {
  const g = new THREE.Group();
  const bodyMat = kind === 'police' ? paintMat(PALETTE.policePaint) : paintMat(paint);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);

  const cabin = new THREE.Mesh(cabinGeo, bodyMat);
  cabin.position.set(0, 1.12, -0.25);
  cabin.castShadow = true;
  g.add(cabin);

  const glassF = new THREE.Mesh(glassGeo, glassMat);
  glassF.position.set(0, 1.14, 1.05);
  glassF.rotation.x = 0.35;
  g.add(glassF);
  const glassR = new THREE.Mesh(glassGeo, glassMat);
  glassR.position.set(0, 1.14, -1.45);
  glassR.rotation.x = -0.3;
  g.add(glassR);

  // Bumpers.
  const bumpF = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH, 0.18, 0.24), chromeMat);
  bumpF.position.set(0, 0.42, CAR_LENGTH / 2);
  g.add(bumpF);
  const bumpR = bumpF.clone();
  bumpR.position.z = -CAR_LENGTH / 2;
  g.add(bumpR);

  // Wheels: cylinders rotated so their axis is across the car.
  const wheelSpots = [
    [-0.95, 1.45],
    [0.95, 1.45],
    [-0.95, -1.45],
    [0.95, -1.45],
  ];
  for (const [wx, wz] of wheelSpots) {
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
  }

  // Headlights and taillights.
  for (const hx of [-0.62, 0.62]) {
    const h = new THREE.Mesh(headGeo, headMat);
    h.position.set(hx, 0.66, CAR_LENGTH / 2 + 0.02);
    g.add(h);
    const t = new THREE.Mesh(tailGeo, tailMat);
    t.position.set(hx, 0.66, -CAR_LENGTH / 2 - 0.02);
    g.add(t);
  }

  if (kind === 'police') {
    const stripe = new THREE.Mesh(stripeGeo, new THREE.MeshLambertMaterial({ color: PALETTE.policeStripe }));
    stripe.position.y = 0.72;
    g.add(stripe);
    const bar = new THREE.Mesh(lightBarGeo, new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.48, -0.25);
    g.add(bar);
    const red = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.4, 1.66, -0.25);
    g.add(red);
    const blue = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.4, 1.66, -0.25);
    g.add(blue);
    g.userData.lights = [red, blue];
  }

  if (kind === 'taxi') {
    const sign = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ color: 0x222222 }));
    sign.position.set(0, 1.5, -0.25);
    g.add(sign);
  }

  if (kind === 'sport') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.5), tyreMat);
    spoiler.position.set(0, 1.05, -CAR_LENGTH / 2 + 0.15);
    g.add(spoiler);
  }

  return g;
}

export function createVehicles(scene, city) {
  const rng = makeRng(777);
  const cars = [];
  const traffic = [];
  const parked = [];
  const lines = city.roadLines;

  function spawnCar(x, z, heading, kind, paint, opts = {}) {
    const mesh = makeCarMesh(paint, kind);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      mesh,
      kind,
      paint,
      x,
      z,
      heading,
      speed: 0,
      steer: 0,
      driver: opts.driver || null,
      parked: !!opts.parked,
      name: opts.name || null,
      cruise: opts.cruise || range(rng, 12, 20),
      axis: opts.axis || 'ns', // 'ns' drives along z, 'ew' along x
      dir: opts.dir || (rng() < 0.5 ? 1 : -1),
      lane: opts.lane !== undefined ? opts.lane : 0, // lateral offset from the line
      line: opts.line !== undefined ? opts.line : null,
      turnCooldown: range(rng, 2, 8),
    };
    mesh.userData.car = car;
    cars.push(car);
    if (!car.parked && car.driver !== 'player') traffic.push(car);
    if (car.parked) parked.push(car);
    return car;
  }

  // Moving traffic: one car per random road line, random axis and direction.
  for (let i = 0; i < CONFIG.trafficCount; i++) {
    const line = pick(rng, lines);
    const axis = rng() < 0.5 ? 'ns' : 'ew';
    const dir = rng() < 0.5 ? 1 : -1;
    const along = range(rng, -city.half + 20, city.half - 20);
    const lane = dir > 0 ? 3.4 : -3.4; // keep right
    const x = axis === 'ns' ? line + lane : along;
    const z = axis === 'ns' ? along : line + lane;
    const heading = axis === 'ns' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const kind = rng() < 0.14 ? 'taxi' : 'civil';
    const paint = kind === 'taxi' ? PALETTE.taxiPaint : pick(rng, PALETTE.carPaints);
    const car = spawnCar(x, z, heading, kind, paint, {
      driver: 'traffic',
      axis,
      dir,
      lane,
      line,
      cruise: range(rng, 11, 19),
    });
    car.speed = car.cruise;
  }

  // Parked cars on the city's spots, including the story cars.
  const storyCars = [
    { spot: 0, paint: 0x2471a3, kind: 'civil', name: 'blue-sedan' },
    { spot: 5, paint: 0xd4af37, kind: 'sport', name: 'gold-coupe' },
    { spot: 9, paint: 0xc0392b, kind: 'sport', name: 'red-coupe' },
  ];
  const usedSpots = new Set();
  for (const sc of storyCars) {
    const spot = city.parkSpots[sc.spot % city.parkSpots.length];
    usedSpots.add(sc.spot % city.parkSpots.length);
    spawnCar(spot.x, spot.z, spot.heading, sc.kind, sc.paint, { parked: true, name: sc.name });
  }
  let parkedTarget = 12;
  let guard = 0;
  while (parked.length < parkedTarget && guard < 400) {
    guard++;
    const idx = intRange(rng, 0, city.parkSpots.length - 1);
    if (usedSpots.has(idx)) continue;
    usedSpots.add(idx);
    const spot = city.parkSpots[idx];
    const kind = rng() < 0.12 ? 'taxi' : 'civil';
    spawnCar(spot.x, spot.z, spot.heading, kind, kind === 'taxi' ? PALETTE.taxiPaint : pick(rng, PALETTE.carPaints), {
      parked: true,
    });
  }

  function nearestCar(x, z, maxD, onlyParked = false) {
    let best = null;
    let bd = maxD;
    for (const car of cars) {
      if (onlyParked && !car.parked) continue;
      if (car.driver === 'player') continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bd) {
        bd = d;
        best = car;
      }
    }
    return best;
  }

  function removeCar(car) {
    for (const list of [cars, traffic, parked]) {
      const i = list.indexOf(car);
      if (i >= 0) list.splice(i, 1);
    }
    scene.remove(car.mesh);
  }

  // Arcade driving: W/S throttle, A/D steer, Space handbrake. Steering bites
  // harder the slower you go; the handbrake kills grip for sharp turns.
  function driveCar(car, input, dt, cityObj) {
    const ax = input.axis();
    const handbrake = input.down('Space');
    const throttle = -ax.z; // W gives axis z = -1, so forward is +1
    const steerInput = ax.x;
    const top = CONFIG.carTopSpeed;
    const reverseTop = 14;
    if (throttle > 0) car.speed += CONFIG.carAccel * dt * throttle;
    else if (throttle < 0) car.speed += CONFIG.carBrake * dt * throttle;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
    car.speed = clamp(car.speed, -reverseTop, top);
    const grip = handbrake ? 0.35 : 1;
    const steerRate = CONFIG.carSteer * clamp(Math.abs(car.speed) / 12, 0.15, 1) * grip;
    car.heading += steerInput * steerRate * Math.sign(car.speed || 1) * dt * (car.speed < 0 ? -1 : 1);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const hit = cityObj.collide(car.x, car.z, 2.2);
    car.x = hit.x;
    car.z = hit.z;
    if (hit.hit) car.speed *= 0.55;
    car.x = clamp(car.x, -cityObj.half - 4, cityObj.half + 4);
    car.z = clamp(car.z, -cityObj.half - 4, cityObj.half + 44);
    // Body roll and wheel spin read off the speed so the car feels alive.
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.z = -steerInput * clamp(Math.abs(car.speed) / top, 0, 1) * 0.05;
    car.steer = steerInput;
  }

  function update(dt, ctx = {}) {
    for (const car of traffic) {
      if (car.driver === 'player') continue;
      if (car.parked) continue;
      car.turnCooldown -= dt;
      // Slow down for a car ahead in the same lane.
      let ahead = null;
      let aheadD = Infinity;
      for (const other of traffic) {
        if (other === car || other.parked || other.driver === 'player') continue;
        if (other.axis !== car.axis || other.dir !== car.dir || other.line !== car.line) continue;
        const along = car.axis === 'ns' ? (other.z - car.z) * car.dir : (other.x - car.x) * car.dir;
        if (along > 0 && along < aheadD) {
          aheadD = along;
          ahead = other;
        }
      }
      let want = car.cruise;
      if (ahead && aheadD < 11) want = Math.min(want, Math.max(0, ahead.speed - 2));
      // Police in a chase ignore the cruise limit (wanted.js steers them).
      if (car.driver === 'police') want = car.cruise;
      car.speed += (want - car.speed) * Math.min(1, dt * 1.6);
      // Turn at intersections: when close to a crossing line, sometimes swap axis.
      const pos = car.axis === 'ns' ? car.z : car.x;
      const cross = city.nearestRoadLine(pos);
      if (car.turnCooldown <= 0 && Math.abs(pos - cross) < 2.5 && rng() < 0.3) {
        car.turnCooldown = range(rng, 6, 14);
        const newAxis = car.axis === 'ns' ? 'ew' : 'ns';
        const newDir = rng() < 0.5 ? 1 : -1;
        car.axis = newAxis;
        car.dir = newDir;
        car.line = cross;
        car.lane = newDir > 0 ? 3.4 : -3.4;
        car.heading = newAxis === 'ns' ? (newDir > 0 ? 0 : Math.PI) : newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      // Advance along the current axis, snapped to the lane.
      if (car.axis === 'ns') {
        car.z += car.dir * car.speed * dt;
        car.x += (car.line + car.lane - car.x) * Math.min(1, dt * 4);
        car.heading = angleLerp(car.heading, car.dir > 0 ? 0 : Math.PI, Math.min(1, dt * 5));
      } else {
        car.x += car.dir * car.speed * dt;
        car.z += (car.line + car.lane - car.z) * Math.min(1, dt * 4);
        car.heading = angleLerp(car.heading, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2, Math.min(1, dt * 5));
      }
      // Wrap around the far edge so traffic never runs dry.
      if (car.axis === 'ns' && (car.z > city.half + 8 || car.z < -city.half - 8)) {
        car.z = car.dir > 0 ? -city.half - 4 : city.half + 4;
      }
      if (car.axis === 'ew' && (car.x > city.half + 8 || car.x < -city.half - 8)) {
        car.x = car.dir > 0 ? -city.half - 4 : city.half + 4;
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
    void ctx;
  }

  return {
    cars,
    traffic,
    parked,
    addCar(x, z, heading, kind, paint, opts = {}) {
      return spawnCar(x, z, heading, kind, paint, opts);
    },
    nearestCar,
    removeCar,
    driveCar,
    update,
    // How many cars are on the road right now (for the HUD's traffic ticker).
    movingCount() {
      let n = 0;
      for (const c of traffic) if (!c.parked && Math.abs(c.speed) > 1) n++;
      return n;
    },
  };
}
