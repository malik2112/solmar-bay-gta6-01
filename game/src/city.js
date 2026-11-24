// SOLMAR BAY — the city itself, built fresh from the tuning in config.js.
// A 9x9 block grid on a 60 m pitch: blocks sit on multiples of 60, roads run
// halfway between them (..., -150, -90, -30, 30, 90, 150, ...), the beach and
// the ocean close the map to the south. Everything the other systems need —
// colliders, parking spots, sidewalk wander points, road centrelines — is
// derived here from one seeded layout so every run looks the same.

import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { makeRng, pick, range, intRange, clamp } from './random.js';

const PITCH = CONFIG.blockSize + CONFIG.roadWidth; // 60 m, block + road
const GRID = CONFIG.cityBlocks; // 9 blocks per side
const HALF = (GRID * PITCH) / 2; // 270 m, city edge
const ROAD_HALF = CONFIG.roadWidth / 2; // 7 m

// Road centrelines: halfway between neighbouring block centres.
function roadLines() {
  const lines = [];
  for (let i = 0; i < GRID; i++) lines.push(-HALF + PITCH * i + PITCH / 2);
  lines.push(-HALF - PITCH / 2);
  lines.push(HALF + PITCH / 2);
  return lines.sort((a, b) => a - b);
}

function blockCentres() {
  const centres = [];
  for (let i = 0; i < GRID; i++) centres.push(-HALF + PITCH / 2 + PITCH * i);
  return centres;
}

// A facade texture painted on a canvas: lit and dark windows in a grid, so a
// plain box reads as a tower without dozens of extra meshes per building.
function facadeTexture(rng, base) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 5;
  const rows = 10;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < 0.34;
      g.fillStyle = lit ? '#ffe9a8' : '#2c3e50';
      g.fillRect(8 + x * 24, 10 + y * 24, 16, 14);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, 128, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function billboardTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg;
  g.font = 'bold 56px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildBayCity(scene) {
  const rng = makeRng(20261124);
  const lines = roadLines();
  const centres = blockCentres();

  const colliders = []; // { x, z, hw, hd } axis-aligned boxes
  const parkSpots = []; // { x, z, heading }
  const sidewalkPoints = []; // { x, z } wander targets for pedestrians
  const roadSpots = []; // { x, z } mid-road points for ambience

  const group = new THREE.Group();
  group.name = 'solmar-city';
  scene.add(group);

  // -- ground -----------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 420, HALF * 2 + 420),
    new THREE.MeshLambertMaterial({ color: 0x7d8a6a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  ground.receiveShadow = true;
  group.add(ground);

  // Beach sand: the whole southern strip, then the ocean beyond it.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 420, 110),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, HALF + 55);
  sand.receiveShadow = true;
  group.add(sand);

  const oceanMat = new THREE.MeshLambertMaterial({
    color: PALETTE.ocean,
    transparent: true,
    opacity: 0.92,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 600, 420), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.05, HALF + 320);
  group.add(ocean);

  // -- roads and sidewalks ----------------------------------------------------
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.asphaltLine });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const roadGeoNS = new THREE.PlaneGeometry(CONFIG.roadWidth, HALF * 2 + CONFIG.roadWidth);
  const roadGeoEW = new THREE.PlaneGeometry(HALF * 2 + CONFIG.roadWidth, CONFIG.roadWidth);
  const dashGeo = new THREE.PlaneGeometry(0.7, 5);

  for (const l of lines) {
    const ns = new THREE.Mesh(roadGeoNS, roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(l, 0.06, 0);
    ns.receiveShadow = true;
    group.add(ns);
    const ew = new THREE.Mesh(roadGeoEW, roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.06, l);
    ew.receiveShadow = true;
    group.add(ew);
    // Centre dashes down both roads.
    for (let t = -HALF + 20; t < HALF; t += 24) {
      const d1 = new THREE.Mesh(dashGeo, lineMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(l, 0.08, t);
      group.add(d1);
      const d2 = new THREE.Mesh(dashGeo, lineMat);
      d2.rotation.x = -Math.PI / 2;
      d2.rotation.z = Math.PI / 2;
      d2.position.set(t, 0.08, l);
      group.add(d2);
    }
  }

  // Sidewalk slabs ring every block; their corners are the ped wander points.
  const walkGeo = new THREE.PlaneGeometry(CONFIG.blockSize + 8, CONFIG.blockSize + 8);
  for (const bx of centres) {
    for (const bz of centres) {
      const slab = new THREE.Mesh(walkGeo, walkMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(bx, 0.04, bz);
      slab.receiveShadow = true;
      group.add(slab);
      const off = CONFIG.blockSize / 2 + 2;
      sidewalkPoints.push(
        { x: bx - off, z: bz - off },
        { x: bx + off, z: bz - off },
        { x: bx - off, z: bz + off },
        { x: bx + off, z: bz + off }
      );
    }
  }

  // -- buildings ---------------------------------------------------------------
  // Three shared facade textures, tinted per building by material colour.
  const facades = [
    facadeTexture(makeRng(11), '#c8b8a0'),
    facadeTexture(makeRng(23), '#a8b8c8'),
    facadeTexture(makeRng(37), '#c8a8a8'),
  ];
  const tintMats = PALETTE.buildingTints.map(
    (t) => new THREE.MeshLambertMaterial({ color: t, map: pick(makeRng(99), facades) })
  );
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5a5e });

  // The two southernmost block rows are beachfront: palms and promenade, no
  // towers, so the ocean stays visible from downtown.
  const beachRows = new Set([centres[centres.length - 1], centres[centres.length - 2]]);
  const plazaBlocks = new Set(['0,0', '-60,-60', '120,60']);

  for (const bx of centres) {
    for (const bz of centres) {
      const key = `${bx},${bz}`;
      if (beachRows.has(bz) || plazaBlocks.has(key)) continue;
      const roll = rng();
      const spots = [];
      if (roll < 0.45) {
        spots.push({ dx: 0, dz: 0, w: 34, d: 34, h: range(rng, 22, CONFIG.buildingMaxH) });
      } else if (roll < 0.8) {
        spots.push({ dx: -11, dz: 0, w: 20, d: 34, h: range(rng, 14, 42) });
        spots.push({ dx: 11, dz: 0, w: 20, d: 34, h: range(rng, 10, 30) });
      } else {
        spots.push({ dx: 0, dz: -11, w: 34, d: 18, h: range(rng, 12, 26) });
        spots.push({ dx: 0, dz: 11, w: 34, d: 18, h: range(rng, 16, 48) });
      }
      for (const s of spots) {
        const mat = tintMats[intRange(rng, 0, tintMats.length - 1)];
        const tower = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), mat);
        tower.position.set(bx + s.dx, s.h / 2, bz + s.dz);
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(s.w + 1, 1.2, s.d + 1), roofMat);
        roof.position.set(bx + s.dx, s.h + 0.6, bz + s.dz);
        group.add(roof);
        // Rooftop AC box on taller towers.
        if (s.h > 34) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 4), roofMat);
          ac.position.set(bx + s.dx + 6, s.h + 2.2, bz + s.dz - 5);
          group.add(ac);
        }
        colliders.push({ x: bx + s.dx, z: bz + s.dz, hw: s.w / 2 + 0.4, hd: s.d / 2 + 0.4 });
      }
    }
  }

  // -- palms, streetlights, billboards ----------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 7, 6);
  const leafGeo = new THREE.ConeGeometry(2.6, 2.4, 6);

  function palm(x, z, lean) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3.5;
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    p.add(trunk);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.sin((i * Math.PI * 2) / 3) * 1.1, 7.4, Math.cos((i * Math.PI * 2) / 3) * 1.1);
      leaf.rotation.z = 0.9;
      leaf.rotation.y = (i * Math.PI * 2) / 3;
      p.add(leaf);
    }
    p.position.set(x, 0, z);
    group.add(p);
    colliders.push({ x, z, hw: 0.6, hd: 0.6 });
    return p;
  }

  // Palm rows along the beachfront promenade and the marina approach.
  for (let x = -HALF + 20; x <= HALF - 10; x += 30) {
    palm(x + range(rng, -4, 4), HALF - 18 + range(rng, -3, 3), range(rng, -0.12, 0.12));
  }
  for (let z = -HALF + 30; z <= HALF - 60; z += 44) {
    palm(186 + range(rng, -3, 3), z, range(rng, -0.1, 0.1));
  }

  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f44 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 7.5, 6);
  const lampGeo = new THREE.SphereGeometry(0.55, 8, 6);
  for (const l of lines) {
    for (let t = -HALF + 30; t < HALF; t += 120) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(l + ROAD_HALF + 1.2, 3.75, t);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(l + ROAD_HALF + 1.2, 7.6, t);
      group.add(lamp);
    }
  }

  const boards = [
    { text: 'SOLMAR BAY', bg: '#123a5c', fg: '#ffd84d', x: -60, z: -238, ry: 0 },
    { text: 'PALMA HOTEL', bg: '#7a2e3f', fg: '#ffe9a8', x: 120, z: 178, ry: Math.PI },
    { text: 'BAY 88 FM', bg: '#1e6b4a', fg: '#ffffff', x: -238, z: 60, ry: Math.PI / 2 },
  ];
  for (const b of boards) {
    const tex = billboardTexture(b.text, b.bg, b.fg);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(26, 6.5, 0.8),
      new THREE.MeshLambertMaterial({ map: tex })
    );
    board.position.set(b.x, 16, b.z);
    board.rotation.y = b.ry;
    group.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, 13, 1.2), poleMat);
    post.position.set(b.x, 6.5, b.z);
    group.add(post);
    colliders.push({ x: b.x, z: b.z, hw: 1, hd: 1 });
  }

  // -- marina lighthouse at the south-east corner ------------------------------
  const lightTower = new THREE.Group();
  const towerMat = new THREE.MeshLambertMaterial({ color: 0xe8e0d0 });
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - i * 0.3, 3 - i * 0.3, 7, 10), i % 2 === 0 ? towerMat : stripeMat);
    seg.position.y = 3.5 + i * 7;
    seg.castShadow = true;
    lightTower.add(seg);
  }
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3, 10), lampMat);
  lampRoom.position.y = 30;
  lightTower.add(lampRoom);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 60, 12, 1, true), beamMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(30, 30, 0);
  lightTower.add(beam);
  lightTower.position.set(HALF - 14, 0, HALF + 30);
  group.add(lightTower);
  colliders.push({ x: HALF - 14, z: HALF + 30, hw: 3.4, hd: 3.4 });

  // -- parking spots along the road edges --------------------------------------
  for (const l of lines) {
    for (let t = -HALF + 45; t < HALF - 20; t += 60) {
      if (rng() < 0.62) {
        parkSpots.push({ x: l + ROAD_HALF + 3.4, z: t, heading: 0 });
        parkSpots.push({ x: l - ROAD_HALF - 3.4, z: t + 30, heading: Math.PI });
      }
    }
  }
  for (let t = -HALF + 45; t < HALF - 20; t += 60) {
    roadSpots.push({ x: 0, z: t });
  }

  // -- drifting clouds ----------------------------------------------------------
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffs = intRange(rng, 3, 5);
    for (let j = 0; j < puffs; j++) {
      const r = range(rng, 6, 13);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), cloudMat);
      puff.position.set(j * range(rng, 7, 11) - puffs * 4, range(rng, -2, 2), range(rng, -5, 5));
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    cloud.position.set(range(rng, -HALF, HALF), range(rng, 90, 130), range(rng, -HALF, HALF));
    group.add(cloud);
    clouds.push({ group: cloud, speed: range(rng, 1.5, 3.5) });
  }

  // -- collision ---------------------------------------------------------------
  function collide(x, z, r) {
    let hit = false;
    for (const c of colliders) {
      const cx = clamp(x, c.x - c.hw, c.x + c.hw);
      const cz = clamp(z, c.z - c.hd, c.z + c.hd);
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        } else {
          // Dead centre: push out along the smaller penetration axis.
          const px = c.hw + r - Math.abs(x - c.x);
          const pz = c.hd + r - Math.abs(z - c.z);
          if (px < pz) x = c.x + (x >= c.x ? c.hw + r : -(c.hw + r));
          else z = c.z + (z >= c.z ? c.hd + r : -(c.hd + r));
        }
      }
    }
    return { x, z, hit };
  }

  function insideCity(x, z) {
    return x >= -HALF && x <= HALF && z >= -HALF && z <= HALF + 60;
  }

  let elapsed = 0;
  return {
    group,
    half: HALF,
    pitch: PITCH,
    roadLines: lines,
    blockCentres: centres,
    colliders,
    parkSpots,
    sidewalkPoints,
    roadSpots,
    collide,
    insideCity,
    // Nearest road centreline to a point (for traffic snapping).
    nearestRoadLine(v) {
      let best = lines[0];
      let bd = Infinity;
      for (const l of lines) {
        const d = Math.abs(v - l);
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
      return best;
    },
    update(dt, t) {
      elapsed += dt;
      void t;
      for (const c of clouds) {
        c.group.position.x += c.speed * dt;
        if (c.group.position.x > HALF + 80) c.group.position.x = -HALF - 80;
      }
      // Gentle ocean swell: the water plane breathes in and out.
      ocean.scale.x = 1 + Math.sin(elapsed * 0.35) * 0.012;
      oceanMat.opacity = 0.9 + Math.sin(elapsed * 0.5) * 0.03;
      // The lighthouse beam sweeps the bay.
      beam.rotation.y = elapsed * 0.55;
      lampRoom.material = lampMat;
    },
  };
}
