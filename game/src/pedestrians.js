// PALMA HEAT — sidewalk pedestrians with swing-limb walk cycles and fleeing.
import * as THREE from 'three';
import { ROADS, G, clamp, collide, dist2d } from './config.js';
import { rngRange, rngPick } from './rng.js';
const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
const SKIN = [0xe8b88a, 0xc98a5a, 0x8a5a34, 0xf2cfae];
const SHIRT = [0xd94f30, 0x2e7fbf, 0xf2e2c4, 0x53ae62, 0xff7d9c, 0x2fb3a8, 0xf2c230];
const PANTS = [0x2c3440, 0x5a4632, 0x707880, 0x33475c];
// One reusable humanoid rig: torso, head, two arms, two legs on pivots.
export function makeHuman(scene, opts = {}) {
  const grp = new THREE.Group();
  const skin = mat(opts.skin || rngPick(Math.random, SKIN));
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.28), mat(opts.shirt || rngPick(Math.random, SHIRT)));
  torso.position.y = 1.06; grp.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.66; grp.add(head);
  if (opts.cap) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.1, 10), mat(opts.cap)); cap.position.y = 1.82; grp.add(cap); }
  const mkLimb = (w, len, material) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), material);
    m.position.y = -len / 2; pivot.add(m); return pivot;
  };
  const armL = mkLimb(0.13, 0.62, skin); armL.position.set(-0.34, 1.38, 0); grp.add(armL);
  const armR = mkLimb(0.13, 0.62, skin); armR.position.set(0.34, 1.38, 0); grp.add(armR);
  const legMat = mat(opts.pants || rngPick(Math.random, PANTS));
  const legL = mkLimb(0.16, 0.72, legMat); legL.position.set(-0.14, 0.72, 0); grp.add(legL);
  const legR = mkLimb(0.16, 0.72, legMat); legR.position.set(0.14, 0.72, 0); grp.add(legR);
  scene.add(grp);
  return { grp, armL, armR, legL, legR, phase: Math.random() * 6, pos: grp.position, yaw: 0 };
}
export function animateHuman(h, speed, dt) {
  h.phase += dt * (2 + Math.abs(speed) * 2.4);
  const s = Math.sin(h.phase) * clamp(Math.abs(speed) / 3, 0, 1) * 0.65;
  h.legL.rotation.x = s; h.legR.rotation.x = -s;
  h.armL.rotation.x = -s * 0.8; h.armR.rotation.x = s * 0.8;
  h.grp.position.y = Math.abs(Math.sin(h.phase)) * 0.04 * clamp(Math.abs(speed) / 3, 0, 1);
}
export function spawnPeds(scene, count, rng) {
  for (let i = 0; i < count; i++) {
    const h = makeHuman(scene);
    const road = rngPick(rng, ROADS), along = rngRange(rng, -185, 185);
    const axis = rng() < 0.5 ? 'x' : 'z';
    const side = rng() < 0.5 ? -10.5 : 10.5;
    if (axis === 'x') h.pos.set(along, 0, road + side); else h.pos.set(road + side, 0, along);
    const ped = { ...h, axis, dir: rng() < 0.5 ? 1 : -1, road, side, speed: rngRange(rng, 1.1, 1.9), fleeT: 0, fleeFrom: null, dead: false };
    G.peds.push(ped);
  }
}
export function scarePeds(x, z, radius) {
  for (const p of G.peds) if (!p.dead && dist2d(p.pos.x, p.pos.z, x, z) < radius) { p.fleeT = 2.6; p.fleeFrom = { x, z }; }
}
export function updatePed(p, dt) {
  if (p.dead) return;
  let vx = 0, vz = 0, speed = p.speed;
  if (p.fleeT > 0 && p.fleeFrom) {
    p.fleeT -= dt; speed = 4.6;
    const dx = p.pos.x - p.fleeFrom.x, dz = p.pos.z - p.fleeFrom.z, d = Math.hypot(dx, dz) || 1;
    vx = dx / d * speed; vz = dz / d * speed;
  } else if (p.axis === 'x') vx = p.dir * speed; else vz = p.dir * speed;
  let nx = p.pos.x + vx * dt, nz = p.pos.z + vz * dt;
  [nx, nz] = collide(nx, nz, 0.35);
  // Hit by a moving car? (checked by game loop via G.onPedHit)
  p.pos.x = nx; p.pos.z = nz;
  if (vx || vz) p.yaw = Math.atan2(vx, vz);
  p.grp.rotation.y = p.yaw;
  animateHuman(p, speed, dt);
  // At an intersection, sometimes change street or direction.
  const along = p.axis === 'x' ? p.pos.x : p.pos.z;
  for (const r of ROADS) if (Math.abs(along - r) < 0.4 && Math.random() < 0.012) {
    if (Math.random() < 0.5) { p.axis = p.axis === 'x' ? 'z' : 'x'; p.road = p.axis === 'x' ? p.pos.z - p.side : p.pos.x - p.side; p.side = Math.random() < 0.5 ? -10.5 : 10.5; }
    else p.dir *= -1;
  }
  if (Math.abs(p.pos.x) > 200 || Math.abs(p.pos.z) > 200) p.dir *= -1;
}
