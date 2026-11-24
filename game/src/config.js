// SOLMAR BAY — shared tuning, palette and story data.
// Every number the game balances on lives here so the other modules stay small.

export const CONFIG = {
  title: 'SOLMAR BAY',
  tagline: 'A sun-soaked open-world crime story',
  cityBlocks: 9,          // blocks per side of the road grid
  blockSize: 46,          // metres of one city block (building + sidewalk)
  roadWidth: 14,          // metres of asphalt between blocks
  buildingMaxH: 64,
  playerWalkSpeed: 9,
  playerRunSpeed: 15,
  carTopSpeed: 46,
  carAccel: 26,
  carBrake: 40,
  carSteer: 1.9,
  trafficCount: 14,
  pedCount: 26,
  policeMax: 4,
  gravity: 30,
  startMoney: 120,
  startHealth: 100,
  pistolDamage: 34,
  pistolAmmo: 12,
  wantedDecayPerSec: 0.045,
  bustHoldSeconds: 2.5,
  minimapRange: 190,
  saveKey: 'solmar-bay-save-v1',
};

export const PALETTE = {
  sky: 0x7ec8ee,
  sun: 0xfff2cf,
  ocean: 0x1b7f9e,
  sand: 0xe8cf9e,
  asphalt: 0x33363d,
  asphaltLine: 0xd8d23a,
  sidewalk: 0x9a938a,
  grass: 0x5da24a,
  buildingTints: [0xd9a066, 0x8fb7c9, 0xc97f7f, 0xa8b89a, 0xe0cf9f, 0x9a8fc7, 0x7fb3a3, 0xd8d8d8],
  windowLit: 0xffe9a8,
  windowDark: 0x2c3e50,
  carPaints: [0xc0392b, 0x2471a3, 0xf1c40f, 0x1e8449, 0x7d3c98, 0xe67e22, 0xeeeeee, 0x222222, 0x16a085, 0xd35400],
  palmTrunk: 0x8a6b46,
  palmLeaf: 0x3e9b4f,
  policePaint: 0xf4f6f7,
  policeStripe: 0x1a5276,
  taxiPaint: 0xf7dc6f,
  beacon: 0xffd84d,
  marker: 0xff5a5a,
};

// Five story missions. Each step is a place to reach plus an optional action key.
export const MISSIONS = [
  {
    id: 'm1',
    name: 'First Wheels',
    giver: 'Mara',
    brief: 'Mara needs wheels. Steal any parked car and bring it to the marina gate.',
    steps: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'reach', at: [150, -150], text: 'Drive the car to the Marina Gate marker' },
    ],
    reward: 250,
  },
  {
    id: 'm2',
    name: 'Beachfront Pickup',
    giver: 'Mara',
    brief: 'A package is waiting on the beachfront. Grab it on foot, then lose the heat.',
    steps: [
      { kind: 'reach', at: [-160, 295], text: 'Pick up the package on the beachfront' },
      { kind: 'cooldown', text: 'Drop your wanted level back to zero' },
    ],
    reward: 400,
  },
  {
    id: 'm3',
    name: 'The Marina Job',
    giver: 'Dario',
    brief: 'Dario wants the blue sedan at the marina. Take it — quietly or loudly — and deliver it.',
    steps: [
      { kind: 'steal', text: 'Steal the blue sedan at the marina' },
      { kind: 'reach', at: [150, 30], text: 'Deliver the sedan to Dario’s garage' },
    ],
    reward: 650,
  },
  {
    id: 'm4',
    name: 'Downtown Getaway',
    giver: 'Mara',
    brief: 'The crew is pinned downtown. Reach them, then shake a two-star chase to the hideout.',
    steps: [
      { kind: 'reach', at: [-30, -90], text: 'Reach the crew downtown' },
      { kind: 'chase', text: 'Lose the police, then reach the hideout marker' },
      { kind: 'reach', at: [30, 150], text: 'Reach the hideout' },
    ],
    reward: 900,
  },
  {
    id: 'm5',
    name: 'Bayfront Finale',
    giver: 'Dario',
    brief: 'One last run: take the gold coupe from the bayfront tower and bring it home.',
    steps: [
      { kind: 'steal', text: 'Steal the gold coupe at the bayfront tower' },
      { kind: 'reach', at: [-150, -150], text: 'Deliver the coupe to the hideout — final score' },
    ],
    reward: 1500,
  },
];

export const RADIO = [
  { name: 'SOLMAR FM — Sunset Drive', bpm: 96, wave: 'triangle', root: 220 },
  { name: 'BAY 88 — Neon Nights', bpm: 122, wave: 'sawtooth', root: 164.81 },
  { name: 'PALMA — Island Slow', bpm: 72, wave: 'sine', root: 196 },
  { name: 'VICE 102 — Palm Static', bpm: 110, wave: 'square', root: 146.83 },
];

// The in-game clock: one full day lasts this many real seconds of play.
export const DAY_CYCLE = {
  dayLengthSeconds: 720,
  dawnMinutes: 360, // 06:00
  duskMinutes: 1140, // 19:00
  startMinutes: 480, // 08:00
};

// Cosmetic weather the city can drift through; only the tint changes, the
// driving never does — Solmar Bay is always open for business.
export const WEATHER = [
  { id: 'clear', name: 'Clear skies', sky: 0x7ec8ee, fog: 0x9fd4ef, sun: 1.7 },
  { id: 'haze', name: 'Sea haze', sky: 0xa8c8d8, fog: 0xb8ccd8, sun: 1.3 },
  { id: 'golden', name: 'Golden hour', sky: 0xe8975a, fog: 0xe8a06a, sun: 1.2 },
  { id: 'dusk', name: 'Neon dusk', sky: 0x5a5a8e, fog: 0x7a6a9e, sun: 0.8 },
];

// Street names for the HUD's location readout, keyed by road centreline.
export const STREET_NAMES = {
  '-270': 'Harbor Ring',
  '-210': 'Coral Row',
  '-150': 'Marina Blvd',
  '-90': 'Palm Court',
  '-30': 'Solmar Ave',
  30: 'Bayfront St',
  90: 'Dario Way',
  150: 'Sunset Strip',
  210: 'Coconut Ln',
  270: 'Ocean Ring',
};

// Named districts, for the pause screen's "you are here" line.
export const DISTRICTS = [
  { name: 'Downtown', x0: -270, z0: -270, x1: 30, z1: -30 },
  { name: 'Marina', x0: 30, z0: -270, x1: 270, z1: -30 },
  { name: 'Old Town', x0: -270, z0: -30, x1: 30, z1: 180 },
  { name: 'Bayfront', x0: 30, z0: -30, x1: 270, z1: 180 },
  { name: 'The Beach', x0: -270, z0: 180, x1: 270, z1: 340 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'Out of town';
}

export function streetAt(v) {
  const lines = Object.keys(STREET_NAMES).map(Number);
  let best = lines[0];
  let bd = Infinity;
  for (const l of lines) {
    const d = Math.abs(v - l);
    if (d < bd) {
      bd = d;
      best = l;
    }
  }
  return STREET_NAMES[String(best)];
}

export const CONTROLS_TEXT = [
  'WASD — move / drive',
  'SHIFT — sprint',
  'E — enter / exit car, pick up',
  'Mouse — aim, Click — shoot',
  'R — reload, Q — change radio',
  'SPACE — handbrake, P — pause, M — mute',
];
