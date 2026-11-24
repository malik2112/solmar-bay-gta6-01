// SOLMAR BAY — pedestrians strolling the sidewalks, with a simple panic
// state: gunfire or a high wanted level makes them run for the beach.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng, pick, range, clamp } from './random.js';

const SHIRTS = [0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0x34495e, 0xe67e22];
const SKINS = [0xc98d64, 0x8d5524, 0xffdbac, 0xf1c27d, 0xe0ac69];

export function createPedestrians(scene, city) {
  const rng = makeRng(4242);
  const peds = [];

  function makePed() {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
    const skin = new THREE.MeshLambertMaterial({ color: pick(rng, SKINS) });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.36), shirt);
    torso.position.y = 1.22;
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.38), skin);
    head.position.y = 1.86;
    g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.28), pants);
    legL.position.set(-0.17, 0.4, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.17;
    g.add(legR);
    scene.add(g);
    const spot = city.sidewalkPoints[Math.floor(rng() * city.sidewalkPoints.length)];
    return {
      group: g,
      legL,
      legR,
      x: spot.x + range(rng, -3, 3),
      z: spot.z + range(rng, -3, 3),
      heading: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1.2, 2.4),
      panic: 0,
      phase: range(rng, 0, 6),
      retarget: 0,
      tx: 0,
      tz: 0,
    };
  }

  for (let i = 0; i < CONFIG.pedCount; i++) peds.push(makePed());

  function retarget(p) {
    const spot = city.sidewalkPoints[Math.floor(rng() * city.sidewalkPoints.length)];
    p.tx = spot.x + range(rng, -4, 4);
    p.tz = spot.z + range(rng, -4, 4);
    p.retarget = range(rng, 6, 16);
  }

  return {
    peds,
    scare(x, z, radius) {
      for (const p of peds) {
        if (Math.hypot(p.x - x, p.z - z) < radius) p.panic = 1;
      }
    },
    // Closest walker to a point, or null when nobody is within maxD.
    nearest(x, z, maxD) {
      let best = null;
      let bd = maxD;
      for (const p of peds) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      return best;
    },
    // How many walkers are currently running for the beach.
    countPanicked() {
      let n = 0;
      for (const p of peds) if (p.panic > 0.05) n++;
      return n;
    },
    update(dt, wantedStars) {
      for (const p of peds) {
        if (wantedStars >= 3) p.panic = Math.max(p.panic, 0.6);
        p.retarget -= dt;
        if (p.retarget <= 0) retarget(p);
        let tx = p.tx;
        let tz = p.tz;
        let speed = p.speed;
        if (p.panic > 0.05) {
          // Run away from the city centre, towards the beach.
          tx = p.x * 1.4;
          tz = city.half + 20;
          speed = 6.5;
          p.panic = Math.max(0, p.panic - dt * 0.12);
        }
        const dx = tx - p.x;
        const dz = tz - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.4) {
          const want = Math.atan2(dx, dz);
          let diff = want - p.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          p.heading += clamp(diff, -dt * 3, dt * 3);
          p.x += Math.sin(p.heading) * speed * dt;
          p.z += Math.cos(p.heading) * speed * dt;
          p.phase += dt * speed * 2.2;
          const swing = Math.sin(p.phase) * 0.45;
          p.legL.rotation.x = swing;
          p.legR.rotation.x = -swing;
        } else {
          p.legL.rotation.x = 0;
          p.legR.rotation.x = 0;
        }
        p.x = clamp(p.x, -city.half - 4, city.half + 4);
        p.z = clamp(p.z, -city.half - 4, city.half + 44);
        p.group.position.set(p.x, 0, p.z);
        p.group.rotation.y = p.heading;
      }
    },
  };
}
