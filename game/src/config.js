// PALMA HEAT — shared configuration and the mutable game-state bag.
// Every module imports CFG for tuning and G for live state, which keeps
// the module graph free of import cycles.
export const CFG = {
  seed: 1,
  world: 210,          // city half-extent in metres (roads span -189..189)
  roadSpacing: 42,      // distance between neighbouring street centrelines
  roadHalf: 7,          // half width of a street
  blockHalf: 14,        // half width of a city block between streets
  bayZ: 196,            // water starts south of this z
  beachZ: 178,          // sand strip starts here
  playerSpeed: 5.2,
  sprintSpeed: 8.4,
  gravity: 0,
  saveKey: 'palmaheat-save-v1',
};
// Road centrelines on both axes: -189, -147, ... 189 (10 streets each way).
export const ROADS = [];
for (let i = 0; i < 10; i++) ROADS.push(-189 + i * CFG.roadSpacing);
export const G = {
  mode: 'title',        // title | play | paused | busted | dead | end
  time: 0, elapsed: 0, cash: 120, wanted: 0, wantedHeat: 0, lastCrimeAt: -99,
  bust: 0, kills: 0, muted: false, started: false, shotName: null,
  scene: null, camera: null, renderer: null, sun: null,
  colliders: [], pois: {}, markers: [],
  cars: [], traffic: [], peds: [], policeCars: [], npcs: [], pickups: [],
  player: null, mission: null, race: null, packages: null,
  input: { keys: {}, mx: 0, my: 0, locked: false, dragging: false, fire: false, fireEdge: false },
  camYaw: 0.6, camPitch: 0.32, shake: 0, flash: 0, slowmo: 1,
  objective: '', toastQueue: [], dialogue: null, interactLabel: '',
  stats: { shots: 0, hits: 0, stolen: 0 },
};
export const POI_DEFS = [
  { id: 'garage', name: "Vega's Garage", x: -168, z: -168, color: 0xff9f2e },
  { id: 'bank', name: 'Palma Trust Bank', x: 21, z: -63, color: 0xffe9a8 },
  { id: 'police', name: 'Police Station', x: 168, z: -105, color: 0x6db7ff },
  { id: 'hospital', name: 'Hospital', x: -105, z: 42, color: 0xffffff },
  { id: 'diner', name: 'Palma Diner', x: 63, z: 105, color: 0xff7d9c },
  { id: 'marina', name: 'Marina Lot', x: 126, z: 168, color: 0x53e0d4 },
  { id: 'docks', name: 'The Docks', x: -147, z: 189, color: 0xc9a06a },
  { id: 'hideout', name: 'Hideout', x: 189, z: -189, color: 0xb28dff },
];
export function poi(id) { return G.pois[id]; }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
// Resolve a circle (x,z,r) out of every AABB collider; returns corrected [x,z].
export function collide(x, z, r) {
  for (const c of G.colliders) {
    const nx = clamp(x, c.x0, c.x1), nz = clamp(z, c.z0, c.z1);
    const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); x = nx + dx / d * r; z = nz + dz / d * r; }
      else { // inside: push out along the smallest penetration axis
        const pl = x - c.x0, pr = c.x1 - x, pt = z - c.z0, pb = c.z1 - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r;
        else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
      }
    }
  }
  const W = CFG.world + 26;
  return [clamp(x, -W, W), clamp(z, -W, CFG.bayZ + 30)];
}
