// SOLMAR BAY — city.js
// One job: build the whole city — ground, road grid, buildings, palms,
// streetlights, beach and sea — and hand back the collision boxes and the
// road graph the traffic AI drives on. Everything is procedural; no assets.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A canvas texture of lit windows, so buildings read as a city, not grey boxes.
function buildingTexture(baseColor, seed) {
  const rng = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  const cols = 5, rows = 12;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < 0.42;
      g.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9ad4ff') : '#2c3a4a';
      g.fillRect(10 + x * 22, 12 + y * 20, 14, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function streetCenters() {
  const xs = [];
  const half = CITY.half;
  const n = CITY.blocks;
  for (let i = 0; i <= n; i++) xs.push(-half + i * CITY.block);
  return xs;
}

export function buildCity(scene, seed = 20261118) {
  const rng = mulberry32(seed);
  const colliders = [];   // {minX,maxX,minZ,maxZ}
  const buildings = [];
  const centers = streetCenters();
  const sw = CITY.streetWidth;
  const half = CITY.half;

  // --- ground: big grass/concrete slab under everything
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 700),
    new THREE.MeshLambertMaterial({ color: 0x8a9a7a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, -0.05, 0);
  scene.add(ground);

  // --- city base slab (pavement colour)
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + sw, half * 2 + sw),
    new THREE.MeshLambertMaterial({ color: 0x7d838a }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.set(0, 0, 0);
  scene.add(slab);

  // --- roads: dark strips on every grid line
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  for (const c of centers) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(sw, half * 2 + sw), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.01, 0);
    scene.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + sw, sw), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.01, c);
    scene.add(h);
    // dashed centre lines
    for (let d = -half; d < half; d += 14) {
      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), lineMat);
      dashV.rotation.x = -Math.PI / 2; dashV.position.set(c, 0.02, d);
      scene.add(dashV);
      const dashH = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), lineMat);
      dashH.rotation.x = -Math.PI / 2; dashH.position.set(d, 0.02, c);
      scene.add(dashH);
    }
  }

  // --- sidewalks: lighter strips hugging each road
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (const c of centers) {
    const v1 = new THREE.Mesh(new THREE.PlaneGeometry(4, half * 2 + sw), walkMat);
    v1.rotation.x = -Math.PI / 2; v1.position.set(c - sw / 2 - 2, 0.015, 0);
    scene.add(v1);
    const v2 = v1.clone(); v2.position.x = c + sw / 2 + 2; scene.add(v2);
    const h1 = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + sw, 4), walkMat);
    h1.rotation.x = -Math.PI / 2; h1.position.set(0, 0.015, c - sw / 2 - 2);
    scene.add(h1);
    const h2 = h1.clone(); h2.position.z = c + sw / 2 + 2; scene.add(h2);
  }

  // --- buildings: 1-3 towers per block, varied heights and pastel colours
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  let seedN = 7;
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let bz = 0; bz < CITY.blocks; bz++) {
      const x0 = -half + bx * CITY.block + sw / 2;
      const z0 = -half + bz * CITY.block + sw / 2;
      const inner = CITY.block - sw;
      const count = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < count; k++) {
        const w = 14 + rng() * 16;
        const d = 14 + rng() * 16;
        const h = 12 + rng() * rng() * 55;
        const px = x0 + 8 + rng() * Math.max(1, inner - w - 16);
        const pz = z0 + 8 + rng() * Math.max(1, inner - d - 16);
        const col = PALETTE.building[Math.floor(rng() * PALETTE.building.length)];
        const tex = buildingTexture(hex(col), seedN++);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(px + w / 2, h / 2, pz + d / 2);
        scene.add(m);
        // rooftop rim
        const rim = new THREE.Mesh(
          new THREE.BoxGeometry(w + 1, 0.8, d + 1),
          new THREE.MeshLambertMaterial({ color: 0x5a5f66 }),
        );
        rim.position.set(px + w / 2, h + 0.4, pz + d / 2);
        scene.add(rim);
        colliders.push({ minX: px, maxX: px + w, minZ: pz, maxZ: pz + d });
        buildings.push(m);
      }
    }
  }

  // --- landmark: the Rosa Delgado garage (mission hub) at Marlin Row
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(26, 9, 18),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  garage.position.set(-186, 4.5, 186);
  scene.add(garage);
  const garageSign = new THREE.Mesh(
    new THREE.BoxGeometry(24, 2.4, 0.6),
    new THREE.MeshBasicMaterial({ color: 0xffe08a }),
  );
  garageSign.position.set(-186, 8.2, 176.6);
  scene.add(garageSign);
  colliders.push({ minX: -199, maxX: -173, minZ: 177, maxZ: 195 });

  // --- landmark: the Bayview Hotel tower, tallest in the city
  const hotel = new THREE.Mesh(
    new THREE.BoxGeometry(24, 88, 24),
    new THREE.MeshLambertMaterial({ map: buildingTexture('#7fb0d8', 99) }),
  );
  hotel.position.set(150, 44, -150);
  scene.add(hotel);
  colliders.push({ minX: 138, maxX: 162, minZ: -162, maxZ: -138 });

  // --- palms along the beachfront avenue
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  const palms = [];
  for (let z = -200; z <= 200; z += 20) {
    for (const px of [214, 222]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
      trunk.position.set(px + rng() * 2, 3.5, z + rng() * 4);
      scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(2.6, 7, 5), leafMat);
      crown.scale.y = 0.55;
      crown.position.set(trunk.position.x, 7.4, trunk.position.z);
      scene.add(crown);
      palms.push(trunk);
    }
  }

  // --- streetlights at every other intersection
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < centers.length; i += 2) {
    for (let j = 0; j < centers.length; j += 2) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6, 6), poleMat);
      pole.position.set(centers[i] + sw / 2 + 1.5, 3, centers[j] + sw / 2 + 1.5);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(centers[i] + sw / 2 + 1.5, 6.2, centers[j] + sw / 2 + 1.5);
      scene.add(lamp);
    }
  }

  // --- beach + sea (east edge)
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, half * 2 + 60),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.beachX + 16, 0.02, 0);
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 700),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CITY.waterX + 110, 0.0, 0);
  scene.add(sea);

  // --- boardwalk piers jutting into the sea
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
  for (const pz of [-70, 60]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(46, 1, 8), pierMat);
    pier.position.set(CITY.beachX + 30, 0.6, pz);
    scene.add(pier);
  }

  // Road graph: intersections the traffic AI drives between.
  const nodes = [];
  for (const x of centers) for (const z of centers) nodes.push({ x, z });
  return { colliders, buildings, nodes, centers, palms };
}

// Circle (player / car) vs building AABB push-out. Returns corrected position.
export function collideCircle(pos, radius, colliders) {
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // centre inside the box: push out along the smallest penetration axis
        const pl = pos.x - b.minX, pr = b.maxX - pos.x;
        const pt = pos.z - b.minZ, pb = b.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = b.minX - radius;
        else if (m === pr) pos.x = b.maxX + radius;
        else if (m === pt) pos.z = b.minZ - radius;
        else pos.z = b.maxZ + radius;
      }
      return true;
    }
  }
  return false;
}
