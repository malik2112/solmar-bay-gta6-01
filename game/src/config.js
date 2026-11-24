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
];

export const CONTROLS_TEXT = [
  'WASD — move / drive',
  'SHIFT — sprint',
  'E — enter / exit car, pick up',
  'Mouse — aim, Click — shoot',
  'R — reload, Q — change radio',
  'SPACE — handbrake, P — pause, M — mute',
];
