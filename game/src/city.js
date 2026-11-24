// SOLMAR BAY — the city itself: a 9x9 road grid on a beachfront peninsula,
// procedural buildings, palms, streetlights, ocean and sky. Pure Three.js boxes.

import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { makeRng, range, intRange, pick } from './random.js';

export function citySize() {
  const pitch = CONFIG.blockSize + CONFIG.roadWidth;
  return CONFIG.cityBlocks * pitch + CONFIG.roadWidth;
}

export function roadLines() {
  // Centre-line coordinates of every road, in world units.
  const pitch = CONFIG.blockSize + CONFIG.roadWidth;
  const half = citySize() / 2;
  const lines = [];
  for (let i = 0; i <= CONFIG.cityBlocks; i++) {
    lines.push(-half + CONFIG.roadWidth / 2 + i * pitch);
  }
  return lines;
}

function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#20242c';
  g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      g.fillStyle = rng() < 0.28 ? '#ffe9a8' : '#31445c';
      g.fillRect(x, y, 8, 7);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene) {
  const rng = makeRng(20261124);
  const size = citySize();
  const half = size / 2;
  const pitch = CONFIG.blockSize + CONFIG.roadWidth;
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const parkSpots = []; // {x, z, heading} places cars can sit
  const sidewalkPoints = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // Sky dome colour + fog for depth.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.sky, 260, 720);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -half;
  sun.shadow.camera.right = half;
  sun.shadow.camera.top = half;
  sun.shadow.camera.bottom = -half;
  sun.shadow.camera.far = 800;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 1.1));

  // Ground slab, sand strip and ocean to the south (+Z).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size + 260, size + 260),
    new THREE.MeshLambertMaterial({ color: 0x6f7d6a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(size + 260, 46),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0, half + 23);
  sand.receiveShadow = true;
  group.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 500),
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, half + 46 + 250);
  group.add(ocean);

  // Roads: dark slabs with dashed centre lines, plus sidewalks per block.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.asphaltLine });
  const lines = roadLines();
  for (const c of lines) {
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.roadWidth, size), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(c, 0.02, 0);
    vRoad.receiveShadow = true;
    group.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(size, CONFIG.roadWidth), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.02, c);
    hRoad.receiveShadow = true;
    group.add(hRoad);
    for (let d = -half + 8; d < half - 4; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 6), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(c, 0.04, d);
      group.add(dash);
    }
  }

  // Buildings, one or two per block, with lit-window texture and roof boxes.
  const winTex = windowTexture(rng);
  const winMat = new THREE.MeshLambertMaterial({ map: winTex });
  for (let bx = 0; bx < CONFIG.cityBlocks; bx++) {
    for (let bz = 0; bz < CONFIG.cityBlocks; bz++) {
      const cx = -half + CONFIG.roadWidth + CONFIG.blockSize / 2 + bx * pitch;
      const cz = -half + CONFIG.roadWidth + CONFIG.blockSize / 2 + bz * pitch;
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.blockSize + 4, CONFIG.blockSize + 4), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(cx, 0.03, cz);
      walk.receiveShadow = true;
      group.add(walk);
      const twin = rng() < 0.4;
      const spots = twin
        ? [
            { dx: -CONFIG.blockSize / 4, dz: 0, w: CONFIG.blockSize / 2 - 4, d: CONFIG.blockSize - 8 },
            { dx: CONFIG.blockSize / 4, dz: 0, w: CONFIG.blockSize / 2 - 4, d: CONFIG.blockSize - 8 },
          ]
        : [{ dx: 0, dz: 0, w: CONFIG.blockSize - 8, d: CONFIG.blockSize - 8 }];
      for (const s of spots) {
        const h = range(rng, 12, CONFIG.buildingMaxH);
        const tint = pick(rng, PALETTE.buildingTints);
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(s.w, h, s.d),
          new THREE.MeshLambertMaterial({ color: tint }),
        );
        body.position.set(cx + s.dx, h / 2, cz + s.dz);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 0.92, h * 0.94), winMat);
        face.position.set(cx + s.dx, h / 2, cz + s.dz + s.d / 2 + 0.06);
        group.add(face);
        const face2 = face.clone();
        face2.rotation.y = Math.PI;
        face2.position.set(cx + s.dx, h / 2, cz + s.dz - s.d / 2 - 0.06);
        group.add(face2);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(s.w * 0.5, 2.4, s.d * 0.5),
          new THREE.MeshLambertMaterial({ color: 0x5a5a5a }),
        );
        roof.position.set(cx + s.dx, h + 1.2, cz + s.dz);
        group.add(roof);
        colliders.push({
          minX: cx + s.dx - s.w / 2,
          maxX: cx + s.dx + s.w / 2,
          minZ: cz + s.dz - s.d / 2,
          maxZ: cz + s.dz + s.d / 2,
        });
      }
      sidewalkPoints.push({ x: cx - CONFIG.blockSize / 2 - 2, z: cz });
      sidewalkPoints.push({ x: cx + CONFIG.blockSize / 2 + 2, z: cz });
    }
  }

  // Parked cars along the roads, on the outer lane.
  for (const c of lines) {
    for (let d = -half + 30; d < half - 20; d += 74) {
      if (rng() < 0.55) parkSpots.push({ x: c + 4.4, z: d, heading: 0 });
      if (rng() < 0.4) parkSpots.push({ x: d, z: c + 4.4, heading: Math.PI / 2 });
    }
  }

  // Palm trees along the beachfront and a few downtown.
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 7), trunkMat);
    trunk.position.y = 4.5;
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.4, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.6, 9.6, Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    group.add(g);
  }
  for (let x = -half + 10; x < half; x += 26) palm(x, half + 8);
  for (let i = 0; i < 14; i++) {
    palm(range(rng, -half + 20, half - 20), range(rng, -half + 20, half - 20));
  }

  // Streetlights at intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const cx of lines) {
    for (const cz of lines) {
      if (intRange(rng, 0, 1) === 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), poleMat);
      pole.position.set(cx + 6, 3.5, cz + 6);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
      lamp.position.set(cx + 6, 7.1, cz + 6);
      group.add(lamp);
    }
  }

  // A few drifting clouds.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 6, 13), 8, 6), cloudMat);
      puff.position.set(j * 9 - 14, range(rng, -2, 2), range(rng, -4, 4));
      puff.scale.y = 0.45;
      cl.add(puff);
    }
    cl.position.set(range(rng, -320, 320), range(rng, 90, 140), range(rng, -320, 320));
    scene.add(cl);
    clouds.push(cl);
  }

  return {
    group,
    colliders,
    parkSpots,
    sidewalkPoints,
    roadLines: lines,
    half,
    clouds,
    // Circle (x,z,r) vs building AABBs: push the circle out, report hit.
    collide(x, z, r) {
      let hit = false;
      for (const b of colliders) {
        const nx = Math.max(b.minX, Math.min(x, b.maxX));
        const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
        const dx = x - nx;
        const dz = z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            x = nx + (dx / d) * r;
            z = nz + (dz / d) * r;
          } else {
            x += r;
          }
        }
      }
      return { x, z, hit };
    },
    insideCity(x, z) {
      return x > -half - 8 && x < half + 8 && z > -half - 8 && z < half + 52;
    },
    update(dt, t) {
      for (let i = 0; i < clouds.length; i++) {
        clouds[i].position.x += dt * (1.5 + i * 0.2);
        if (clouds[i].position.x > 380) clouds[i].position.x = -380;
      }
      ocean.position.y = -0.4 + Math.sin(t * 0.5) * 0.12;
    },
  };
}
