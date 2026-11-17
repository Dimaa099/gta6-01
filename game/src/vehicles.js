// PALMA HEAT — box-built cars: traffic AI, parked cars, arcade driving physics.
import * as THREE from 'three';
import { CFG, ROADS, G, clamp, collide, dist2d } from './config.js';
import { mulberry32, rngRange, rngPick } from './rng.js';
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.35, ...o });
export const CAR_COLORS = [0xd94f30, 0x2e7fbf, 0xf2c230, 0x53ae62, 0xe8e8e8, 0x30343a, 0x8a4fb0, 0x2fb3a8, 0xff7d2e];
let carSeq = 0;
export function createCar(scene, opts = {}) {
  const kind = opts.kind || 'sedan';
  const color = opts.color !== undefined ? opts.color : 0xcccccc;
  const grp = new THREE.Group();
  const L = kind === 'gt' ? 4.6 : kind === 'truck' ? 5.2 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, L), mat(color));
  body.position.y = 0.58; grp.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.8), mat(color));
  hood.position.set(0, 0.82, L / 2 - 0.45); grp.add(hood);
  if (kind === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.85, 1.3), mat(0xdadada));
    cab.position.set(0, 1.15, L / 2 - 1); grp.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.5, 2.6), mat(0x777777));
    bed.position.set(0, 0.95, -1); grp.add(bed);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.52, L * 0.45),
      new THREE.MeshStandardMaterial({ color: 0x223240, roughness: 0.15, metalness: 0.6 }));
    cabin.position.set(0, 1.08, -0.15); grp.add(cabin);
  }
  if (kind === 'gt') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), mat(0x222222));
    spoiler.position.set(0, 1.05, -L / 2 + 0.2); grp.add(spoiler);
  }
  if (kind === 'police') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.87, 0.2, L * 0.9), mat(0x2e4a8f));
    stripe.position.y = 0.58; grp.add(stripe);
    const bar = new THREE.Group();
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }));
    rl.position.x = -0.32; bar.add(rl);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x2266ff, emissiveIntensity: 0.2 }));
    bl.position.x = 0.32; bar.add(bl);
    bar.position.set(0, 1.42, -0.15); grp.add(bar);
    grp.userData.lights = { rl, bl, bar };
  }
  const wheels = [], pivots = [];
  const wg = new THREE.CylinderGeometry(0.37, 0.37, 0.28, 12);
  const wm = mat(0x17181a, { roughness: 0.9, metalness: 0 });
  for (const [wx, wz] of [[-0.85, L / 2 - 0.8], [0.85, L / 2 - 0.8], [-0.85, -L / 2 + 0.8], [0.85, -L / 2 + 0.8]]) {
    const pivot = new THREE.Group(); pivot.position.set(wx, 0.37, wz);
    const wheel = new THREE.Mesh(wg, wm); wheel.rotation.z = Math.PI / 2; pivot.add(wheel);
    grp.add(pivot); wheels.push(wheel); pivots.push(pivot);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffdf80, emissiveIntensity: 0.9 }));
  head.position.set(0, 0.62, L / 2 + 0.02); grp.add(head);
  scene.add(grp);
  const car = {
    id: carSeq++, kind, group: grp, wheels, pivots, L,
    angle: opts.angle || 0, speed: 0, steer: 0, health: 100, smokeT: 0,
    role: opts.role || 'parked', driverGone: false, dead: false,
    axis: opts.axis || 'x', dir: opts.dir || 1, road: opts.road || 0, cruise: rngRange(Math.random, 9, 13),
    pos: grp.position, sirenPhase: Math.random() * 6,
  };
  grp.position.set(opts.x || 0, 0, opts.z || 0); grp.rotation.y = car.angle;
  G.cars.push(car); return car;
}
export function forwardOf(a) { return { x: Math.sin(a), z: Math.cos(a) }; }
export function angleFor(axis, dir) { return axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI); }
export function laneOffset(axis, dir) { return axis === 'x' ? (dir > 0 ? 3 : -3) : (dir > 0 ? -3 : 3); }
export function placeOnRoad(car, roadIdx, along, axis, dir) {
  car.axis = axis; car.dir = dir; car.road = ROADS[roadIdx];
  const off = laneOffset(axis, dir);
  if (axis === 'x') car.group.position.set(along, 0, car.road + off);
  else car.group.position.set(car.road + off, 0, along);
  car.angle = angleFor(axis, dir); car.group.rotation.y = car.angle;
}
export function spawnTraffic(scene, count, rng) {
  for (let i = 0; i < count; i++) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const dir = rng() < 0.5 ? 1 : -1;
    const car = createCar(scene, { kind: rngPick(rng, ['sedan', 'sedan', 'truck', 'gt']), color: rngPick(rng, CAR_COLORS), role: 'traffic' });
    placeOnRoad(car, Math.floor(rng() * 10), rngRange(rng, -185, 185), axis, dir);
    car.speed = car.cruise;
    G.traffic.push(car);
  }
}
export function spawnParked(scene, rng) {
  const spots = [[-154, -140], [-140, -154], [28, -140], [77, 28], [-91, 119], [140, 154], [112, 168], [133, 168], [119, 168], [-28, 77], [168, -28], [-168, 91], [35, 154], [-63, -91]];
  for (const [x, z] of spots) {
    const car = createCar(scene, { kind: rngPick(rng, ['sedan', 'sedan', 'truck']), color: rngPick(rng, CAR_COLORS), role: 'parked', x, z, angle: rngPick(rng, [0, Math.PI / 2, Math.PI]) });
    G.colliders.push({ x0: x - 1.1, x1: x + 1.1, z0: z - 1.1, z1: z + 1.1, carRef: car });
  }
}
// Remove the static collider that a parked car leaves behind when it is taken.
export function freeParkedCollider(car) {
  const i = G.colliders.findIndex((c) => c.carRef === car);
  if (i >= 0) G.colliders.splice(i, 1);
}
export function updateTrafficCar(car, dt) {
  if (car.role !== 'traffic' || car.dead) return;
  // Simple avoidance: slow down for anything close ahead.
  let target = car.cruise;
  const f = forwardOf(car.angle);
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    const dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z;
    const ahead = dx * f.x + dz * f.z, side = Math.abs(dx * f.z - dz * f.x);
    if (ahead > 0 && ahead < 10 && side < 2.2) target = Math.min(target, Math.max(0, o.speed) * 0.8);
  }
  if (G.player) {
    const pp = G.player.inCar ? G.player.inCar.pos : G.player.pos;
    const dx = pp.x - car.pos.x, dz = pp.z - car.pos.z;
    const ahead = dx * f.x + dz * f.z, side = Math.abs(dx * f.z - dz * f.x);
    if (!G.player.inCar && ahead > 0 && ahead < 8 && side < 2) target = 0;
  }
  car.speed += clamp(target - car.speed, -22 * dt, 7 * dt);
  car.pos.x += f.x * car.speed * dt; car.pos.z += f.z * car.speed * dt;
  spinWheels(car, dt);
  // Intersection handling: when the cross-street centre is just ahead, maybe turn.
  const along = car.axis === 'x' ? car.pos.x : car.pos.z;
  for (const r of ROADS) {
    const d = (r - along) * car.dir;
    if (d > 0 && d < car.speed * dt + 0.4) {
      const turn = Math.random();
      if (turn < 0.42) { // turn onto the cross street
        const newAxis = car.axis === 'x' ? 'z' : 'x';
        const newDir = Math.random() < 0.5 ? 1 : -1;
        const crossRoad = car.axis === 'x' ? car.pos.z - laneOffset(car.axis, car.dir) : car.pos.x - laneOffset(car.axis, car.dir);
        car.axis = newAxis; car.dir = newDir; car.road = crossRoad;
        const off = laneOffset(newAxis, newDir);
        if (newAxis === 'x') car.pos.set(r, 0, crossRoad + off); else car.pos.set(crossRoad + off, 0, r);
        car.angle = angleFor(newAxis, newDir);
      }
      break;
    }
  }
  if (Math.abs(car.pos.x) > 205 || Math.abs(car.pos.z) > 205) { // wrap to the far edge
    if (car.axis === 'x') car.pos.x = -Math.sign(car.pos.x) * 200; else car.pos.z = -Math.sign(car.pos.z) * 200;
  }
  car.group.rotation.y = car.angle;
}
export function spinWheels(car, dt) {
  const spin = (car.speed * dt) / 0.37;
  for (const w of car.wheels) w.rotation.x += spin;
  car.pivots[0].rotation.y = car.steer * 0.9; car.pivots[1].rotation.y = car.steer * 0.9;
}
// Arcade drive physics shared by the player car (police add their own steering).
export function driveCar(car, throttle, steerIn, brake, dt) {
  const maxF = car.kind === 'gt' ? 34 : 27, maxR = 9;
  if (brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 30 * dt);
  else if (throttle > 0) car.speed += (car.speed < maxF ? 13 * dt * throttle : 0);
  else if (throttle < 0) car.speed -= (car.speed > -maxR ? 11 * dt * -throttle : 0);
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 3.2 * dt); // engine drag
  car.speed = clamp(car.speed, -maxR, maxF);
  car.steer += clamp(steerIn - car.steer, -6 * dt, 6 * dt);
  if (Math.abs(car.speed) > 0.2) {
    const turnRate = car.steer * clamp(Math.abs(car.speed) / 9, 0, 1.15) * 0.85;
    car.angle += turnRate * dt * Math.sign(car.speed);
  }
  const f = forwardOf(car.angle);
  let nx = car.pos.x + f.x * car.speed * dt, nz = car.pos.z + f.z * car.speed * dt;
  const before = Math.abs(car.speed);
  [nx, nz] = collide(nx, nz, 1.35);
  if (Math.hypot(nx - car.pos.x, nz - car.pos.z) < Math.abs(car.speed * dt) * 0.35 && before > 9) {
    car.health -= (before - 8) * 1.6; car.speed *= -0.25; // crash
    if (G.onCarCrash) G.onCarCrash(car, before);
  }
  car.pos.x = nx; car.pos.z = nz; car.group.rotation.y = car.angle;
  spinWheels(car, dt);
  return car.speed;
}
export function damageCar(car, amt) {
  car.health -= amt;
  if (car.health <= 0 && !car.dead) { car.dead = true; car.speed = 0; car.group.traverse((m) => { if (m.material && m.material.color) m.material = m.material.clone(), m.material.color.multiplyScalar(0.35); }); }
}
