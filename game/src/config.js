// SOLMAR BAY — config.js
// One job: every tunable number, colour and story string in one place so the
// rest of the game reads like a design document, not a pile of magic numbers.
// All names, places and people here are original fiction.
export const GAME_TITLE = 'SOLMAR BAY';
export const GAME_SUBTITLE = 'An open-world crime story in the sun-soaked city of Solmar Bay';
export const SAVE_KEY = 'solmar-bay-save-v1';

// City layout: a 6 x 6 grid of blocks. Streets run on the grid lines.
export const CITY = {
  blocks: 6,          // blocks per side
  block: 70,          // block pitch (metres)
  streetWidth: 16,    // road width
  half: 210,          // city spans -half .. +half on both axes
  beachX: 226,        // sand starts here (east edge)
  waterX: 262,        // sea starts here
  boundX: 288,        // hard world bound east (in the sea, shallow)
  boundZ: 228,
};

// Player / on-foot tuning
export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11,
  radius: 0.6,
  height: 1.8,
  eyeHeight: 1.62,
  maxHp: 100,
  jumpSpeed: 0,
};

// Car tuning (arcade, not a sim: fun first)
export const CAR = {
  accel: 22,
  brake: 34,
  reverseMax: 12,
  maxSpeed: 38,
  turnRate: 1.9,
  grip: 6.5,
  handbrakeTurn: 3.1,
  radius: 1.5,
};

// Traffic + pedestrians
export const TRAFFIC = {
  carCount: 12,
  carSpeed: 10,
  pedCount: 16,
  pedSpeed: 1.6,
};

// Wanted system
export const WANTED = {
  max: 5,
  decaySeconds: 26,       // quiet seconds before one star drops
  bustDistance: 3.2,      // cop must be this close, on foot, to bust
  bustSeconds: 1.6,       // seconds of contact before the bust lands
  heatStealCar: 1,
  heatHitPed: 1,
  heatShoot: 1,
  heatKillCop: 2,
  heatRamCop: 1,
};

// Combat
export const COMBAT = {
  magSize: 12,
  reloadSeconds: 1.4,
  range: 90,
  damage: 34,
  fireInterval: 0.22,
  pedHp: 50,
  copHp: 80,
  rivalHp: 100,
};

// Palette: sun-soaked coastal city, warm light, pastel + neon
export const PALETTE = {
  sky: 0x8ec9e8,
  fog: 0xa8c8dc,
  sun: 0xfff2d0,
  asphalt: 0x2e3138,
  sidewalk: 0x9aa0a3,
  sand: 0xe8d29a,
  sea: 0x2f7fa8,
  building: [0xe8b48a, 0xd9a0a8, 0xa8c4d4, 0xe0d0a0, 0xc4b8d8, 0xf0f0e8, 0x9ab8a0, 0xd88a6a],
  glass: 0x3a5a78,
  palmTrunk: 0x8a6a48,
  palmLeaf: 0x3f9a4a,
  carPaint: [0xc23b2e, 0x2e6fc2, 0xe8c23a, 0x3aa88a, 0x8a5fc2, 0xe8e8e8, 0x222831, 0xd97a2b],
};

// Story: Jax Marlowe, a wheelman new to Solmar Bay, owes fixer Rosa Delgado.
export const STORY = {
  hero: 'Jax Marlowe',
  fixer: 'Rosa Delgado',
  intro:
    'You are Jax Marlowe, a wheelman who just rolled into Solmar Bay with a busted ' +
    'sedan and a debt to Rosa Delgado, who runs the garage on Marlin Row. Pay her back ' +
    'job by job — drive, steal, run — and earn your place as the best driver in the Bay. ' +
    'Watch the stars: the Solmar Bay PD does not forgive.',
  outro:
    'The docks fade behind you, $1,500 richer and finally square with Rosa. ' +
    'Solmar Bay is yours now, Jax — every street, every car, every getaway. ' +
    'KING OF SOLMAR BAY.',
};

// Controls shown on the start screen and pause menu
export const CONTROLS = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Look around (click to lock)'],
  ['Shift', 'Sprint'],
  ['E', 'Enter / exit / steal a car'],
  ['Space', 'Handbrake (in car)'],
  ['Click', 'Fire pistol'],
  ['R', 'Reload'],
  ['M', 'Toggle mission details'],
  ['P / Esc', 'Pause'],
  ['H', 'Toggle radio'],
];
