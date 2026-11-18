// SOLMAR BAY — every tuning number, place and line of story in one place.
// A 6x6-block coastal city: blocks 60 m, roads 14 m, pitch 74 m, span 458 m.
// South (+z past the last road) is the bay: water, beach, pier, marina.
export const STEP = 1 / 60;
export const CITY = { blocks: 6, block: 60, road: 14, pitch: 74, span: 458 };
export const roadCenter = (k) => -CITY.span / 2 + CITY.road / 2 + k * CITY.pitch;
export const blockCenter = (i) => -CITY.span / 2 + CITY.road + CITY.block / 2 + i * CITY.pitch;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const angLerp = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export const PLAYER = { walk: 5, run: 8.5, radius: 0.6, health: 100, punchDmg: 20, punchRange: 2.4 };
export const CAR = { accel: 16, brake: 32, maxSpeed: 34, maxReverse: 11, steer: 1.9, grip: 8 };
export const TRAFFIC_COUNT = 12;
export const PED_COUNT = 16;

export const WANTED = { max: 5, stealHeat: 34, assaultHeat: 20, killHeat: 40, decayPerSec: 1.6, escapeRadius: 70, escapeSecs: 12 };

export const HUB = { x: blockCenter(1), z: blockCenter(5), label: "Rosa's Garage" };
export const PLACES = {
  pier: { x: 0, z: CITY.span / 2 + 26, label: 'Solmar Pier' },
  bank: { x: blockCenter(4), z: blockCenter(0), label: 'Bayfront Bank' },
  marina: { x: blockCenter(5), z: blockCenter(5), label: 'Marina Norte' },
  safehouse: { x: blockCenter(0), z: blockCenter(0), label: 'Safehouse' },
  plaza: { x: blockCenter(3), z: blockCenter(3), label: 'Plaza del Sol' },
};

// Five jobs from fixer Rosa Delgado. Each is a list of steps: reach the marker.
export const MISSIONS = [
  { id: 0, name: 'First Wheels', reward: 250,
    brief: 'Rosa needs wheels. Steal any car on the street, then bring it to my garage.',
    steps: [{ x: HUB.x, z: HUB.z, label: "Bring a stolen car to Rosa's Garage", needCar: true }] },
  { id: 1, name: 'Bayfront Pickup', reward: 400,
    brief: 'A package is waiting at the end of Solmar Pier. Grab it and bring it back to me.',
    steps: [
      { x: PLACES.pier.x, z: PLACES.pier.z, label: 'Pick up the package at Solmar Pier' },
      { x: HUB.x, z: HUB.z, label: "Deliver the package to Rosa's Garage" },
    ] },
  { id: 2, name: 'Heat on the Strip', reward: 600,
    brief: 'The cops are hot. Lose them — get your wanted level to zero — then lay low at the safehouse.',
    steps: [
      { x: 0, z: 0, label: 'Lose the cops (wanted level 0)', needClear: true },
      { x: PLACES.safehouse.x, z: PLACES.safehouse.z, label: 'Reach the Safehouse' },
    ] },
  { id: 3, name: 'Sunset Courier', reward: 800, timeLimit: 150,
    brief: 'A buyer waits at Marina Norte. 150 seconds. Drive like the sunset is chasing you.',
    steps: [{ x: PLACES.marina.x, z: PLACES.marina.z, label: 'Deliver to Marina Norte before time runs out' }] },
  { id: 4, name: 'The Bay Job', reward: 1500,
    brief: 'The big one. Hit Bayfront Bank, grab the cash, and bring it home to the garage. Expect heat.',
    steps: [
      { x: PLACES.bank.x, z: PLACES.bank.z, label: 'Rob Bayfront Bank' },
      { x: HUB.x, z: HUB.z, label: "Escape to Rosa's Garage with the cash" },
    ] },
];

export const PALETTE = {
  sky: 0x2e2450, fog: 0x2e2450, sun: 0xffb36b, hemiSky: 0xffd9a0, hemiGround: 0x2a2438,
  asphalt: 0x2b2e35, sidewalk: 0x4a4a52, blockBase: 0x3a3a44, ground: 0x23232c,
  water: 0x14506e, sand: 0xc2a878, pier: 0x7a5c38,
  building: [0x8a6f5c, 0x6b7a8c, 0x9c8a6a, 0x7a6a8a, 0x5c7a6b, 0xa08a7a, 0x6a6a7a, 0x8c7a5c],
  car: [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0xd8d8d8, 0x222222, 0x7a3ec2, 0xe07830],
  pedShirt: [0xe05a5a, 0x5a8ae0, 0x5ae08a, 0xe0c95a, 0x9a5ae0, 0x5adfe0, 0xe08a5a, 0x8ae05a],
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmar-bay.save.v1';
export const BOOT_DELAY_MS = 1500;
