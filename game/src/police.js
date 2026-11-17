// PALMA HEAT — wanted stars, police pursuit cars, foot officers, bust meter.
import * as THREE from 'three';
import { ROADS, G, clamp, collide, dist2d } from './config.js';
import { createCar, spinWheels } from './vehicles.js';
import { spawnNPC } from './combat.js';
import { sirenSound } from './audio.js';
let spawnCd = 0, decayT = 0, officerCd = 0;
export function crime(kind) {
  const table = { theft: 1, shot: 1, pedhit: 2, assault: 1, copdown: 1, carhit: 1 };
  if (kind === 'copdown') G.wanted = clamp(G.wanted + 1, 0, 5);
  else G.wanted = clamp(Math.max(G.wanted, table[kind] || 1), 0, 5);
  G.lastCrimeAt = G.elapsed; G.wantedHeat = 1;
}
export function setWanted(n) { G.wanted = clamp(n, 0, 5); G.lastCrimeAt = G.elapsed; }
export function clearWanted() { G.wanted = 0; G.bust = 0; despawnPolice(); }
function despawnPolice() {
  for (const c of G.policeCars) { G.scene.remove(c.group); const i = G.cars.indexOf(c); if (i >= 0) G.cars.splice(i, 1); }
  G.policeCars.length = 0;
  for (let i = G.npcs.length - 1; i >= 0; i--) if (G.npcs[i].kind === 'officer') { G.scene.remove(G.npcs[i].grp); G.npcs.splice(i, 1); }
}
function spawnPoliceCar() {
  const p = G.player; if (!p) return;
  // Spawn on a road at the city edge, on the player's side of town.
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  const road = ROADS[Math.floor(Math.random() * 10)];
  const edge = (Math.random() < 0.5 ? -196 : 196);
  const car = createCar(G.scene, { kind: 'police', color: 0xf0f2f4, role: 'police' });
  if (axis === 'x') car.pos.set(edge, 0, road); else car.pos.set(road, 0, edge);
  car.angle = Math.atan2(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
  car.cruise = 25 + G.wanted * 1.6;
  G.policeCars.push(car);
}
export function updatePolice(dt) {
  const p = G.player; if (!p) return;
  spawnCd -= dt; officerCd -= dt;
  const desired = G.wanted === 0 ? 0 : Math.min(2 + G.wanted, 6);
  if (G.wanted > 0 && G.policeCars.length < desired && spawnCd <= 0) { spawnPoliceCar(); spawnCd = 2.2; }
  if (G.wanted === 0 && G.policeCars.length) despawnPolice();
  // Wanted decay: only while no police unit is close enough to see the player.
  const nearest = nearestPoliceDist();
  const observed = nearest < 42;
  if (G.wanted > 0 && !observed && G.elapsed - G.lastCrimeAt > 7) {
    decayT += dt;
    if (decayT > 9) { decayT = 0; setWanted(G.wanted - 1); if (G.toast && G.wanted > 0) G.toast('Heat cooling… ' + G.wanted + '★'); }
  } else decayT = Math.max(0, decayT - dt);
  let anyNear = false;
  for (const car of G.policeCars) {
    if (car.dead) continue;
    const d = dist2d(car.pos.x, car.pos.z, p.pos.x, p.pos.z);
    if (d < 60) anyNear = true;
    pursue(car, dt);
    // Flashing light bar.
    const lights = car.group.userData.lights;
    if (lights) {
      const ph = Math.sin(G.elapsed * 9 + car.sirenPhase) > 0;
      lights.rl.material.emissiveIntensity = ph ? 3 : 0.15;
      lights.bl.material.emissiveIntensity = ph ? 0.15 : 3;
    }
    // Officers pile out when close at 3+ stars.
    if (G.wanted >= 3 && d < 16 && officerCd <= 0 && G.npcs.filter((n) => n.kind === 'officer' && !n.dead).length < G.wanted) {
      officerCd = 4;
      const off = spawnNPC(G.scene, car.pos.x + 2, car.pos.z + 1, { kind: 'officer', hostile: true, shirt: 0x2e4a8f, health: 55, name: 'Officer' });
      off.kind = 'officer';
    }
  }
  sirenSound(anyNear && G.wanted > 0, Math.sin(G.elapsed * 9) > 0);
  // Bust meter: police close + player slow = arrest.
  const pSpeed = p.inCar ? Math.abs(p.inCar.speed) : (p.speedNow || 0);
  if (G.wanted > 0 && nearest < 10 && pSpeed < 2.2 && G.mode === 'play') {
    G.bust += dt / 2.6;
    if (G.bust >= 1 && G.onBusted) G.onBusted();
  } else G.bust = Math.max(0, G.bust - dt * 0.7);
}
function nearestPoliceDist() {
  const p = G.player; let best = 1e9;
  for (const c of G.policeCars) best = Math.min(best, dist2d(c.pos.x, c.pos.z, p.pos.x, p.pos.z));
  for (const n of G.npcs) if (n.kind === 'officer' && !n.dead) best = Math.min(best, dist2d(n.pos.x, n.pos.z, p.pos.x, p.pos.z));
  return best;
}
function pursue(car, dt) {
  const p = G.player;
  const target = p.inCar ? p.inCar.pos : p.pos;
  const dx = target.x - car.pos.x, dz = target.z - car.pos.z;
  const d = Math.hypot(dx, dz);
  const desired = Math.atan2(dx, dz);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxTurn = 1.9 * dt;
  car.angle += clamp(diff, -maxTurn, maxTurn);
  const top = d > 30 ? car.cruise + 4 : car.cruise * 0.82;
  if (Math.abs(diff) > 2.4) car.speed = Math.max(0, car.speed - 18 * dt); // lost him: brake & turn
  else car.speed += clamp((d < 4.5 ? 0 : top) - car.speed, -26 * dt, 10 * dt);
  // Traffic / player-car avoidance nudge.
  const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
  let nx = car.pos.x + fx * car.speed * dt, nz = car.pos.z + fz * car.speed * dt;
  const ox = nx, oz = nz;
  [nx, nz] = collide(nx, nz, 1.35);
  if (Math.hypot(nx - ox, nz - oz) > 0.4 && car.speed > 6) { car.speed *= -0.3; car.health -= 2; }
  car.pos.x = nx; car.pos.z = nz; car.group.rotation.y = car.angle;
  car.steer = clamp(diff, -0.6, 0.6);
  spinWheels(car, dt);
  // Ramming the player's car hurts both a little.
  if (p.inCar && d < 3.4 && Math.abs(car.speed) > 5) { p.inCar.health -= 4 * dt * 3; car.health -= 2 * dt * 3; }
}
export function policeCount() { return G.policeCars.length; }
