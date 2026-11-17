// PALMA HEAT — Marco Reyes: on-foot movement, third-person camera, car entry.
import * as THREE from 'three';
import { CFG, G, clamp, collide } from './config.js';
import { makeHuman, animateHuman } from './pedestrians.js';
import { driveCar, freeParkedCollider } from './vehicles.js';
import { sfx } from './audio.js';
export function createPlayer(scene) {
  const human = makeHuman(scene, { shirt: 0xf2e2c4, pants: 0x2c3440, skin: 0xc98a5a });
  const p = {
    ...human, health: 100, maxHealth: 100, yaw: 0.6, speedNow: 0,
    inCar: null, mag: 12, reserve: 48, reloading: 0, fireCd: 0, meleeCd: 0,
    dead: false, walkSpeed: 0,
  };
  p.pos.set(-168, 0, -152); p.grp.rotation.y = p.yaw;
  G.player = p; return p;
}
export function hurtPlayer(amt) {
  const p = G.player; if (!p || p.dead || G.mode !== 'play') return;
  p.health -= amt; G.flash = Math.min(1, G.flash + 0.55); G.shake = Math.min(0.5, G.shake + 0.18);
  sfx.hurt();
  if (p.health <= 0) { p.health = 0; p.dead = true; }
}
export function healPlayer(amt) { const p = G.player; p.health = clamp(p.health + amt, 0, p.maxHealth); }
export function nearestCar(maxD = 4) {
  const p = G.player; let best = null, bd = maxD;
  for (const c of G.cars) {
    if (c.dead && c.health <= -20) continue;
    const d = Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
export function enterCar(car) {
  const p = G.player;
  const wasTraffic = car.role === 'traffic', wasParked = car.role === 'parked';
  if (wasParked) freeParkedCollider(car);
  car.role = 'player'; car.speed = Math.min(car.speed, 4);
  const ti = G.traffic.indexOf(car); if (ti >= 0) G.traffic.splice(ti, 1);
  p.inCar = car; p.grp.visible = false; sfx.door();
  if (wasTraffic) { // driver bails out and runs; theft is a crime
    G.stats.stolen++;
    if (G.onDriverFlee) G.onDriverFlee(car.pos.x, car.pos.z);
    if (G.crime) G.crime('theft');
  } else if (G.mission && G.mission.onEnterCar) G.mission.onEnterCar(car);
}
export function exitCar() {
  const p = G.player, car = p.inCar; if (!car) return;
  car.role = 'parked'; car.speed = 0;
  const side = { x: Math.cos(car.angle), z: -Math.sin(car.angle) };
  let nx = car.pos.x + side.x * 2.2, nz = car.pos.z + side.z * 2.2;
  [nx, nz] = collide(nx, nz, 0.4);
  p.pos.set(nx, 0, nz); p.inCar = null; p.grp.visible = true; sfx.door();
  G.colliders.push({ x0: car.pos.x - 1.1, x1: car.pos.x + 1.1, z0: car.pos.z - 1.1, z1: car.pos.z + 1.1, carRef: car });
}
export function updatePlayer(dt) {
  const p = G.player, inp = G.input;
  if (p.reloading > 0) { p.reloading -= dt; if (p.reloading <= 0) { const need = 12 - p.mag, take = Math.min(need, p.reserve); p.mag += take; p.reserve -= take; } }
  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.meleeCd > 0) p.meleeCd -= dt;
  if (p.inCar) {
    const car = p.inCar;
    const th = (inp.keys.KeyW ? 1 : 0) + (inp.keys.KeyS ? -1 : 0);
    const st = (inp.keys.KeyA ? 1 : 0) + (inp.keys.KeyD ? -1 : 0);
    driveCar(car, th, st, !!inp.keys.Space, dt);
    p.pos.set(car.pos.x, 0, car.pos.z); p.yaw = car.angle;
    G.camYaw = car.angle + Math.PI; // chase cam sits behind the car
    return;
  }
  // On foot: WASD relative to camera yaw.
  const fwd = (inp.keys.KeyW ? 1 : 0) + (inp.keys.KeyS ? -1 : 0);
  const str = (inp.keys.KeyD ? 1 : 0) + (inp.keys.KeyA ? -1 : 0);
  const sprint = inp.keys.ShiftLeft || inp.keys.ShiftRight;
  const sp = sprint ? CFG.sprintSpeed : CFG.playerSpeed;
  const sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
  // Camera looks along -(sin,cos) in xz; forward on ground = (-sin,-cos)... derived from camera offset below.
  let mx = (-sin * fwd + -cos * -str), mz = (-cos * fwd + sin * -str);
  // (kept explicit: right vector is (-cos, sin) rotated) — normalise below.
  const len = Math.hypot(mx, mz);
  p.speedNow = len > 0 ? sp : 0;
  if (len > 0) {
    mx = mx / len * sp; mz = mz / len * sp;
    let nx = p.pos.x + mx * dt, nz = p.pos.z + mz * dt;
    [nx, nz] = collide(nx, nz, 0.42);
    p.pos.x = nx; p.pos.z = nz;
    p.yaw = Math.atan2(mx, mz); p.grp.rotation.y = p.yaw;
  }
  animateHuman(p, p.speedNow, dt);
}
export function updateCamera(dt) {
  const p = G.player, cam = G.camera; if (!cam || !p) return;
  let tx, ty, tz, lx, ly, lz;
  if (p.inCar) {
    const car = p.inCar, back = 9.5 + Math.abs(car.speed) * 0.12;
    tx = car.pos.x - Math.sin(car.angle) * back; tz = car.pos.z - Math.cos(car.angle) * back; ty = 4.2;
    lx = car.pos.x + Math.sin(car.angle) * 8; lz = car.pos.z + Math.cos(car.angle) * 8; ly = 1.4;
  } else {
    const d = 6.2, cp = Math.cos(G.camPitch), sp2 = Math.sin(G.camPitch);
    tx = p.pos.x + Math.sin(G.camYaw) * d * cp; tz = p.pos.z + Math.cos(G.camYaw) * d * cp; ty = 1.7 + d * sp2;
    lx = p.pos.x; lz = p.pos.z; ly = 1.45;
  }
  const k = 1 - Math.pow(0.0001, dt); // smooth follow
  cam.position.x += (tx - cam.position.x) * k;
  cam.position.y += (ty - cam.position.y) * k;
  cam.position.z += (tz - cam.position.z) * k;
  if (G.shake > 0) { cam.position.x += (Math.random() - 0.5) * G.shake; cam.position.y += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt * 1.4); }
  cam.lookAt(lx, ly, lz);
}
// Player aim direction (for shooting): from camera yaw/pitch on foot, car heading in a car.
export function aimDir() {
  const p = G.player;
  if (p.inCar) return { x: Math.sin(p.inCar.angle), y: 0, z: Math.cos(p.inCar.angle) };
  return { x: -Math.sin(G.camYaw) * Math.cos(G.camPitch), y: -Math.sin(G.camPitch) * 0.55, z: -Math.cos(G.camYaw) * Math.cos(G.camPitch) };
}
