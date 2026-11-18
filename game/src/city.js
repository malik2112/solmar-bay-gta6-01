// SOLMAR BAY's city: 6x6 blocks on a road grid, the bay along the south edge,
// Rosa's Garage (hub), the pier, the bank, the marina and the safehouse.
// Builds the three.js scene and the AABB colliders the physics pushes against.
import * as THREE from 'three';
import { CITY, HUB, PLACES, PALETTE, roadCenter, blockCenter } from './config.js';

function windowsTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#20242e'; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 8; x < 56; x += 14) {
      const lit = rng.chance(0.45);
      g.fillStyle = lit ? (rng.chance(0.5) ? '#ffd98a' : '#9fd8ff') : '#12151d';
      g.fillRect(x, y, 9, 11);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text, sub, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 52px system-ui, sans-serif';
  g.fillText(text, 256, 52);
  g.font = '28px system-ui, sans-serif';
  g.fillText(sub, 256, 98);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function addSign(scene, text, sub, bg, fg, x, y, z, w, ry) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w / 4),
    new THREE.MeshBasicMaterial({ map: signTexture(text, sub, bg, fg) }),
  );
  m.position.set(x, y, z);
  m.rotation.y = ry;
  scene.add(m);
  return m;
}

// Push a circle (x, z, radius) out of every building AABB it overlaps.
export function collideCircle(colliders, x, z, radius) {
  let px = x;
  let pz = z;
  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i];
    const cx = Math.max(b.minX, Math.min(px, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * radius;
        pz = cz + (dz / d) * radius;
      } else {
        // Centre inside the box: shove out along the smallest penetration.
        const pl = px - b.minX;
        const pr = b.maxX - px;
        const pt = pz - b.minZ;
        const pb = b.maxZ - pz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) px = b.minX - radius;
        else if (m === pr) px = b.maxX + radius;
        else if (m === pt) pz = b.minZ - radius;
        else pz = b.maxZ + radius;
      }
    }
  }
  return { x: px, z: pz };
}

export function buildCity(scene, rng) {
  const S = CITY.span;
  const half = S / 2;
  const colliders = [];
  const buildings = [];
  const winTex = windowsTexture(rng);

  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 140, 780);

  const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sun.position.set(-180, 120, 260); // low western sun: long dusk shadows
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x40385a, 0.5));

  // Ground slab under everything, then the bay water south of the city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(S + 700, S + 700),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 120);
  scene.add(ground);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 320),
    new THREE.MeshLambertMaterial({ color: PALETTE.water }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.02, half + 160);
  scene.add(water);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(S + 60, 22),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, half + 11);
  scene.add(sand);

  // Asphalt: one slab per road strip, vertical and horizontal.
  const asphaltMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  for (let k = 0; k <= CITY.blocks; k++) {
    const c = roadCenter(k);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, S), asphaltMat);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0, 0); scene.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(S, CITY.road), asphaltMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0, c); scene.add(h);
  }
  // Centre dashes on every road.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
  const dashGeo = new THREE.BoxGeometry(0.5, 0.06, 4);
  for (let k = 0; k <= CITY.blocks; k++) {
    const c = roadCenter(k);
    for (let t = -half + 12; t < half - 8; t += 16) {
      const d1 = new THREE.Mesh(dashGeo, dashMat);
      d1.position.set(c, 0.05, t); scene.add(d1);
      const d2 = new THREE.Mesh(dashGeo, dashMat);
      d2.rotation.y = Math.PI / 2; d2.position.set(t, 0.05, c); scene.add(d2);
    }
  }

  // Blocks: sidewalks + buildings. One landmark block each for hub / bank / marina.
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const blockGeo = new THREE.BoxGeometry(CITY.block, 0.5, CITY.block);
  for (let i = 0; i < CITY.blocks; i++) {
    for (let j = 0; j < CITY.blocks; j++) {
      const bx = blockCenter(i);
      const bz = blockCenter(j);
      const base = new THREE.Mesh(blockGeo, sidewalkMat);
      base.position.set(bx, 0.2, bz);
      scene.add(base);
      const isHub = Math.abs(bx - HUB.x) < 1 && Math.abs(bz - HUB.z) < 1;
      const isBank = Math.abs(bx - PLACES.bank.x) < 1 && Math.abs(bz - PLACES.bank.z) < 1;
      const isMarina = Math.abs(bx - PLACES.marina.x) < 1 && Math.abs(bz - PLACES.marina.z) < 1;
      const isSafe = Math.abs(bx - PLACES.safehouse.x) < 1 && Math.abs(bz - PLACES.safehouse.z) < 1;
      const isPlaza = Math.abs(bx - PLACES.plaza.x) < 1 && Math.abs(bz - PLACES.plaza.z) < 1;
      if (isPlaza) {
        // Open plaza: fountain + palms, no buildings — a place to fight and meet.
        const f = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 16), new THREE.MeshLambertMaterial({ color: 0x3a6a8a }));
        f.position.set(bx, 0.9, bz); scene.add(f);
        colliders.push({ minX: bx - 8, maxX: bx + 8, minZ: bz - 8, maxZ: bz + 8 });
        continue;
      }
      if (isMarina) {
        // Marina yard: low sheds + moored boats at the quay.
        for (let s = 0; s < 3; s++) {
          const shed = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 10), new THREE.MeshLambertMaterial({ color: 0x5a6a7a }));
          shed.position.set(bx - 16 + s * 16, 2.7, bz - 14);
          scene.add(shed);
          colliders.push({ minX: bx - 24 + s * 16, maxX: bx - 8 + s * 16, minZ: bz - 19, maxZ: bz - 9 });
        }
        continue;
      }
      // 2x2 lots; most hold a building, some stay empty (parking / yard).
      for (let lx = -1; lx <= 1; lx += 2) {
        for (let lz = -1; lz <= 1; lz += 2) {
          if (!isHub && !isBank && !isSafe && rng.chance(0.18)) continue;
          const cx = bx + lx * 15;
          const cz = bz + lz * 15;
          const w = rng.range(13, 17);
          const d = rng.range(13, 17);
          let h = rng.range(9, 30);
          let color = rng.pick(PALETTE.building);
          if (isHub) { h = 7; color = 0x7a3a2e; }
          if (isBank) { h = 22; color = 0x8a8a9a; }
          if (isSafe) { h = 10; color = 0x4a5a3a; }
          const mat = new THREE.MeshLambertMaterial({ color, map: h > 12 ? winTex : null, emissive: 0x111111 });
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(cx, 0.5 + h / 2, cz);
          scene.add(b);
          buildings.push(b);
          colliders.push({ minX: cx - w / 2 - 0.4, maxX: cx + w / 2 + 0.4, minZ: cz - d / 2 - 0.4, maxZ: cz + d / 2 + 0.4 });
        }
      }
    }
  }

  // Landmark signs (canvas textures, no network).
  addSign(scene, "ROSA'S GARAGE", 'FIXER • CHOP SHOP • NO QUESTIONS', '#2e1a12', '#ffb36b', HUB.x, 9.5, HUB.z - 24, 34, 0);
  addSign(scene, 'BAYFRONT BANK', 'SOLMAR BAY • EST 1987', '#1a2233', '#9fd8ff', PLACES.bank.x, 24, PLACES.bank.z - 22, 30, 0);
  addSign(scene, 'MARINA NORTE', 'BOATS • FISH • SUNSETS', '#0e2a33', '#7fe0c2', PLACES.marina.x, 8, PLACES.marina.z - 20, 30, 0);
  addSign(scene, 'SOLMAR BAY', 'CITY OF THE SETTING SUN', '#241a3a', '#ffd98a', 0, 26, -half - 4, 60, 0);

  // The pier: deck + posts + a moored boat, jutting into the bay.
  const pierMat = new THREE.MeshLambertMaterial({ color: PALETTE.pier });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 52), pierMat);
  deck.position.set(PLACES.pier.x, 1.2, PLACES.pier.z + 8);
  scene.add(deck);
  colliders.push({ minX: PLACES.pier.x - 5, maxX: PLACES.pier.x + 5, minZ: PLACES.pier.z - 18, maxZ: PLACES.pier.z + 34 });
  for (let p = 0; p < 5; p++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6), pierMat);
    post.position.set(PLACES.pier.x - 4.4, 0.6, PLACES.pier.z - 14 + p * 12);
    scene.add(post);
    const post2 = post.clone(); post2.position.x = PLACES.pier.x + 4.4; scene.add(post2);
  }
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
  const boat = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 12), boatMat);
  boat.position.set(PLACES.pier.x + 10, 0.8, PLACES.pier.z + 14);
  scene.add(boat);
  const boat2 = boat.clone(); boat2.position.set(PLACES.pier.x - 12, 0.8, PLACES.pier.z + 22); boat2.rotation.y = 0.4; scene.add(boat2);

  // Palms along the beach + a few lamps on the main avenue.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2e });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7a3a });
  for (let i = 0; i < 14; i++) {
    const px = -half + 20 + i * 34 + rng.range(-6, 6);
    const pz = half + 8 + rng.range(-2, 4);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(px, 3.5, pz); scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 7), leafMat);
    crown.position.set(px, 8.2, pz); scene.add(crown);
  }
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe0a0 });
  for (let k = 0; k <= CITY.blocks; k += 2) {
    for (const z of [-half + 40, 0, half - 40]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8, 6), lampMat);
      pole.position.set(roadCenter(k) + 6, 4, z); scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampGlow);
      bulb.position.set(roadCenter(k) + 6, 8.2, z); scene.add(bulb);
    }
  }

  return {
    colliders, buildings, half,
    roadLines: Array.from({ length: 7 }, (_, k) => roadCenter(k)),
    hub: HUB, places: PLACES,
  };
}
