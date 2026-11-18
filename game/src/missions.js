// SOLMAR BAY — missions.js
// One job: the story. Five jobs for fixer Rosa Delgado, each a small state
// machine: an objective, a 3D beacon, a minimap blip, a timer where the job
// needs one, and a cash reward. Finishing all five ends the story.
import * as THREE from 'three';
import { spawnPed } from './pedestrians.js';
import { syncPolice } from './wanted.js';

export const MISSIONS = [
  {
    id: 1, title: 'First Errand', reward: 200,
    brief: 'Rosa: "My sedan is parked by the garage, Jax. Drive it to the pier drop-off at the east beach. No scratches — it is not yours."',
    objective: 'Drive Rosa\'s sedan to the pier drop-off',
    target: { x: 236, z: 60 },
    type: 'reach', needCar: true, radius: 9,
  },
  {
    id: 2, title: 'Borrowed Wheels', reward: 350,
    brief: 'Rosa: "A client wants a sunrise-yellow coupe. Not to buy — to borrow. Permanently. Steal any car and bring it to my garage."',
    objective: 'Steal a car and bring it to Rosa\'s garage',
    target: { x: -186, z: 168 },
    type: 'steal-deliver', radius: 10,
  },
  {
    id: 3, title: 'Hot Pursuit', reward: 500,
    brief: 'Rosa: "You clipped a cruiser, Jax. The whole PD is awake. Lose the heat, then get to the safehouse on Coral Street. Do not get busted."',
    objective: 'Lose the wanted level, then reach the safehouse',
    target: { x: 100, z: -100 },
    type: 'lose-heat', radius: 10, startHeat: 2,
  },
  {
    id: 4, title: 'Package Run', reward: 700,
    brief: 'Rosa: "Three packages, three corners of the Bay, 150 seconds. The buyers do not wait and neither do I."',
    objective: 'Collect 3 packages before the timer runs out',
    type: 'collect', count: 3, timeLimit: 150,
    packages: [{ x: -170, z: -170 }, { x: 170, z: 170 }, { x: 30, z: -170 }],
  },
  {
    id: 5, title: 'The Big One', reward: 1500,
    brief: 'Rosa: "Last job, Jax. The Bayview vault crew left a gap at dawn. Grab the cash, dodge the guards, and bring it to the docks. Then we are square."',
    objective: 'Grab the cash at Bayview Hotel, then escape to the docks',
    target: { x: 150, z: -138 },
    type: 'grab-escape', escape: { x: 236, z: -70 }, radius: 10, startHeat: 3,
  },
];

export function createMissions() {
  return {
    index: 0,              // 0-based into MISSIONS; 5 = story complete
    state: 'idle',         // idle | active | done
    timer: 0,
    collected: 0,
    packageIndex: 0,
    phase: 0,              // for multi-phase missions (grab -> escape)
    beacon: null,          // THREE.Group beacon mesh
    beaconPos: null,       // {x,z} of the current objective
    pkgMeshes: [],
  };
}

export function currentMission(m) {
  return m.index < MISSIONS.length ? MISSIONS[m.index] : null;
}

function makeBeacon(scene) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 40, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  cyl.position.y = 20;
  g.add(cyl);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.3, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  g.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  diamond.position.y = 8;
  g.add(diamond);
  g.userData.diamond = diamond;
  scene.add(g);
  return g;
}

function clearBeacon(G) {
  const m = G.missions;
  if (m.beacon) { G.scene.remove(m.beacon); m.beacon = null; }
  m.beaconPos = null;
  for (const p of m.pkgMeshes) G.scene.remove(p);
  m.pkgMeshes = [];
}

function placeBeacon(G, pos) {
  clearBeacon(G);
  const b = makeBeacon(G.scene);
  b.position.set(pos.x, 0, pos.z);
  G.missions.beacon = b;
  G.missions.beaconPos = { x: pos.x, z: pos.z };
}

// The garage hub beacon: go here to start the next job.
export function placeHubBeacon(G) {
  if (!G.missions.beacon) placeBeacon(G, { x: -186, z: 168 });
}

export function startMission(G, index) {
  const m = G.missions;
  m.index = index;
  m.state = 'active';
  m.collected = 0;
  m.packageIndex = 0;
  m.phase = 0;
  const def = MISSIONS[index];
  if (!def) { m.state = 'done'; return; }
  m.timer = def.timeLimit || 0;
  if (def.type === 'collect') {
    // beacons on all packages; the nearest uncollected one is the target
    for (const p of def.packages) {
      const b = makeBeacon(G.scene);
      b.position.set(p.x, 0, p.z);
      b.scale.setScalar(0.6);
      m.pkgMeshes.push(b);
    }
    m.beaconPos = { ...def.packages[0] };
  } else if (def.target) {
    placeBeacon(G, def.target);
  }
  if (def.startHeat) {
    // the job starts hot: the PD is already looking for Jax
    G.wanted.level = Math.max(G.wanted.level, def.startHeat);
    G.wanted.quietTimer = 0;
    G.sound.sirenStart();
    G.wanted.sirenOn = true;
    syncPolice(G);
  }
  G.hudMessage(`MISSION ${def.id}: ${def.title} — $${def.reward}`, 'mission');
  G.sound.missionStart();
  G.showBriefing(def);
}

// Called by main.js whenever Jax gets into a car.
export function onPlayerEnterCar(G) {
  const m = G.missions;
  if (m.state === 'active' && MISSIONS[m.index] && MISSIONS[m.index].type === 'steal-deliver') {
    m.phase = 1; // the car is "borrowed" now — deliver it to the garage
  }
}

export function updateMissions(G, dt) {
  const m = G.missions;
  if (m.state !== 'active') return;
  const def = MISSIONS[m.index];
  if (!def) return;
  if (def.timeLimit) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(G, 'Out of time.');
      return;
    }
  }
  // beacon shimmer
  if (m.beacon && m.beacon.userData.diamond) {
    m.beacon.userData.diamond.rotation.y += dt * 2;
    m.beacon.userData.diamond.position.y = 8 + Math.sin(G.time * 2.5) * 0.8;
  }
  const px = G.player.pos.x, pz = G.player.pos.z;
  const near = (t, r) => Math.hypot(px - t.x, pz - t.z) < r;
  switch (def.type) {
    case 'reach':
      if (near(def.target, def.radius) && !G.player.onFoot) completeMission(G);
      else if (near(def.target, def.radius) && G.player.onFoot) {
        G.hudHint('You need to be in a car for this drop-off.');
      }
      break;
    case 'steal-deliver':
      if (near(def.target, def.radius) && !G.player.onFoot && G.missions.phase === 1) {
        completeMission(G);
      }
      break;
    case 'lose-heat':
      if (G.wanted.level === 0 && m.phase === 0) {
        m.phase = 1;
        G.hudMessage('Heat is off — get to the safehouse!', 'good');
        placeBeacon(G, def.target);
      }
      if (m.phase === 1 && near(def.target, def.radius)) completeMission(G);
      break;
    case 'collect': {
      const pkg = def.packages[m.packageIndex];
      if (pkg && near(pkg, 4)) {
        m.collected++;
        G.sound.cash();
        G.player.cash += 50;
        G.hudMessage(`Package ${m.collected}/${def.count} collected (+$50)`, 'good');
        const mesh = m.pkgMeshes[m.packageIndex];
        if (mesh) { G.scene.remove(mesh); }
        m.packageIndex++;
        if (m.packageIndex < def.packages.length) {
          m.beaconPos = { ...def.packages[m.packageIndex] };
        } else {
          completeMission(G);
        }
      }
      break;
    }
    case 'grab-escape':
      if (m.phase === 0 && near(def.target, def.radius)) {
        m.phase = 1;
        G.player.cash += 1500; // the vault cash, in hand already
        G.hudMessage('Cash grabbed! Get to the docks — the PD is coming!', 'bad');
        G.sound.cash();
        placeBeacon(G, def.escape);
        // guards spawn at the hotel
        spawnRivals(G, def.target);
      } else if (m.phase === 1 && near(def.escape, def.radius)) {
        completeMission(G);
      }
      break;
    default:
      break;
  }
}

function spawnRivals(G, at) {
  for (let i = 0; i < 2; i++) {
    const r = spawnPed(G.scene, at.x + (i ? 6 : -6), at.z + 8, Math.random, 'rival');
    r.hp = 100;
    r.shootTimer = 1;
    r.mesh.children[0].material = r.mesh.children[0].material.clone();
    G.rivals.push(r);
    G.peds.push(r);
  }
}

function completeMission(G) {
  const m = G.missions;
  const def = MISSIONS[m.index];
  G.player.cash += def.reward;
  G.sound.cash();
  G.hudMessage(`MISSION COMPLETE: ${def.title} — +$${def.reward}`, 'good');
  G.stats.missionsDone++;
  clearBeacon(G);
  m.index++;
  m.state = 'idle';
  if (m.index >= MISSIONS.length) {
    G.storyComplete();
    return;
  }
  G.saveGame();
  // the next job starts when Jax drives back to the garage
  G.hudMessage('New job at Rosa\'s garage — drive to the red garage on Marlin Row.', 'mission');
  placeBeacon(G, { x: -186, z: 168 });
  m.state = 'waiting-hub';
}

export function failMission(G, reason) {
  const m = G.missions;
  G.hudMessage(`MISSION FAILED: ${reason} Talk to Rosa to retry.`, 'bad');
  G.sound.busted();
  clearBeacon(G);
  m.state = 'idle';
  placeBeacon(G, { x: -186, z: 168 });
  m.state = 'waiting-hub';
}

// At the garage hub: walk/drive into the beacon to start the next job.
export function updateHub(G) {
  const m = G.missions;
  if (m.state !== 'waiting-hub') return;
  const d = Math.hypot(G.player.pos.x + 186, G.player.pos.z - 168);
  if (d < 9) startMission(G, m.index);
}

export function missionObjectiveText(G) {
  const m = G.missions;
  if (m.state === 'waiting-hub') {
    const next = MISSIONS[m.index];
    return next ? `Go to Rosa's garage to start: ${next.title}` : 'Story complete!';
  }
  if (m.state !== 'active') return 'No active mission';
  const def = MISSIONS[m.index];
  let text = def.objective;
  if (def.type === 'collect') text += ` — ${m.collected}/${def.count}`;
  if (def.timeLimit) text += ` — ${Math.max(0, Math.ceil(m.timer))}s left`;
  if (def.type === 'grab-escape' && m.phase === 1) text = 'Escape to the docks!';
  if (def.type === 'lose-heat' && m.phase === 0) text = 'Lose the wanted level!';
  return text;
}
