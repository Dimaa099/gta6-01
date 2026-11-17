// PALMA HEAT — hitscan pistol, melee, fightable NPCs (guards & officers), pickups.
import * as THREE from 'three';
import { G, clamp, collide, dist2d } from './config.js';
import { makeHuman, animateHuman, scarePeds } from './pedestrians.js';
import { aimDir, hurtPlayer } from './player.js';
import { damageCar } from './vehicles.js';
import { sfx } from './audio.js';
const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
export function spawnNPC(scene, x, z, opts = {}) {
  const h = makeHuman(scene, { shirt: opts.shirt || 0x33475c, pants: 0x22262c, skin: opts.skin, cap: opts.cap || 0x22355c });
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.42), mat(0x14161a));
  gun.position.set(0, -0.6, 0.25); h.armR.add(gun);
  h.pos.set(x, 0, z);
  const npc = {
    ...h, kind: opts.kind || 'guard', health: opts.health || 60, maxHealth: opts.health || 60,
    hostile: !!opts.hostile, dead: false, shootCd: 1 + Math.random(), hitT: 0,
    home: { x, z }, speed: 3.1, name: opts.name || 'Guard',
  };
  G.npcs.push(npc); return npc;
}
export function damageNPC(npc, amt, fromX, fromZ) {
  if (npc.dead) return;
  npc.health -= amt; npc.hitT = 0.18; npc.hostile = true;
  npc.grp.position.x += (npc.pos.x - fromX) * 0.02;
  if (npc.health <= 0) {
    npc.dead = true; G.kills++;
    npc.grp.rotation.x = -Math.PI / 2; npc.grp.position.y = 0.25;
    if (G.crime && npc.kind === 'officer') G.crime('copdown');
    if (Math.random() < 0.6) spawnPickup(npc.pos.x, npc.pos.z, 'ammo');
  }
}
function tracer(a, b, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  G.scene.add(line); G.tracers.push({ line, t: 0.09 });
}
export function updateTracers(dt) {
  if (!G.tracers) G.tracers = [];
  for (let i = G.tracers.length - 1; i >= 0; i--) {
    const t = G.tracers[i]; t.t -= dt;
    if (t.t <= 0) { G.scene.remove(t.line); t.line.geometry.dispose(); G.tracers.splice(i, 1); }
  }
}
export function fireGun() {
  const p = G.player;
  if (!p || p.fireCd > 0 || G.mode !== 'play') return;
  if (p.reloading > 0) return;
  if (p.mag <= 0) { sfx.empty(); p.fireCd = 0.25; return; }
  p.fireCd = 0.16; p.mag--; G.stats.shots++;
  sfx.shot(); scarePeds(p.pos.x, p.pos.z, 26);
  if (G.crime) G.crime('shot');
  const d = aimDir();
  const ox = p.pos.x, oz = p.pos.z, oy = 1.45;
  let bestT = 48, hitPoint = { x: ox + d.x * 48, y: oy + d.y * 48, z: oz + d.z * 48 };
  let hitNPC = null, hitCar = null, hitPed = null;
  const testSphere = (cx, cy, cz, r) => {
    const vx = cx - ox, vy = cy - oy, vz = cz - oz;
    const t = vx * d.x + vy * d.y + vz * d.z;
    if (t < 0 || t > bestT) return -1;
    const px = ox + d.x * t, py = oy + d.y * t, pz = oz + d.z * t;
    return Math.hypot(cx - px, cy - py, cz - pz) < r ? t : -1;
  };
  for (const n of G.npcs) { if (n.dead) continue; const t = testSphere(n.pos.x, 1.1, n.pos.z, 0.85); if (t > 0) { bestT = t; hitNPC = n; } }
  for (const pd of G.peds) { if (pd.dead) continue; const t = testSphere(pd.pos.x, 1.1, pd.pos.z, 0.8); if (t > 0) { bestT = t; hitPed = pd; hitNPC = null; } }
  for (const c of G.cars) { if (c === p.inCar) continue; const t = testSphere(c.pos.x, 0.8, c.pos.z, 2); if (t > 0) { bestT = t; hitCar = c; hitNPC = null; hitPed = null; } }
  hitPoint = { x: ox + d.x * bestT, y: oy + d.y * bestT, z: oz + d.z * bestT };
  tracer({ x: ox + d.x * 0.5, y: oy, z: oz + d.z * 0.5 }, hitPoint, 0xffe9a8);
  if (G.flashLight) { G.flashLight.position.set(ox + d.x * 1.2, 1.6, oz + d.z * 1.2); G.flashLight.intensity = 26; }
  if (hitNPC) { G.stats.hits++; damageNPC(hitNPC, 26, ox, oz); }
  else if (hitPed) { G.stats.hits++; hitPed.dead = true; hitPed.grp.rotation.x = -Math.PI / 2; hitPed.grp.position.y = 0.25; if (G.crime) G.crime('pedhit'); }
  else if (hitCar) damageCar(hitCar, 9);
}
export function melee() {
  const p = G.player;
  if (!p || p.meleeCd > 0 || p.inCar) return;
  p.meleeCd = 0.45; sfx.punch();
  p.armR.rotation.x = -1.8; setTimeout(() => { if (G.player) G.player.armR.rotation.x = 0; }, 130);
  const d = aimDir();
  for (const n of G.npcs) {
    if (n.dead) continue;
    const dx = n.pos.x - p.pos.x, dz = n.pos.z - p.pos.z;
    if (Math.hypot(dx, dz) < 2.1 && (dx * d.x + dz * d.z) > 0) { damageNPC(n, 34, p.pos.x, p.pos.z); return; }
  }
  for (const pd of G.peds) {
    if (pd.dead) continue;
    const dx = pd.pos.x - p.pos.x, dz = pd.pos.z - p.pos.z;
    if (Math.hypot(dx, dz) < 2.1 && (dx * d.x + dz * d.z) > 0) {
      pd.dead = true; pd.grp.rotation.x = -Math.PI / 2; pd.grp.position.y = 0.25;
      scarePeds(p.pos.x, p.pos.z, 18); if (G.crime) G.crime('pedhit'); return;
    }
  }
}
export function updateNPC(npc, dt) {
  if (npc.dead) return;
  if (npc.hitT > 0) npc.hitT -= dt;
  const p = G.player; if (!p) return;
  const d = dist2d(npc.pos.x, npc.pos.z, p.pos.x, p.pos.z);
  npc.yaw = Math.atan2(p.pos.x - npc.pos.x, p.pos.z - npc.pos.z);
  if (npc.hostile && G.mode === 'play') {
    npc.grp.rotation.y = npc.yaw;
    if (d > 17) {
      let nx = npc.pos.x + Math.sin(npc.yaw) * npc.speed * dt, nz = npc.pos.z + Math.cos(npc.yaw) * npc.speed * dt;
      [nx, nz] = collide(nx, nz, 0.4); npc.pos.x = nx; npc.pos.z = nz;
      animateHuman(npc, npc.speed, dt);
    } else animateHuman(npc, 0, dt);
    npc.shootCd -= dt;
    if (npc.shootCd <= 0 && d < 26) {
      npc.shootCd = 1.05 + Math.random() * 0.8;
      sfx.enemyShot();
      tracer({ x: npc.pos.x, y: 1.35, z: npc.pos.z }, { x: p.pos.x, y: 1.2, z: p.pos.z }, 0xff9a7a);
      const hitChance = clamp(0.62 - d * 0.014, 0.12, 0.55) * (p.inCar ? 0.8 : 1);
      if (Math.random() < hitChance) { if (p.inCar) { p.inCar.health -= 3; hurtPlayer(2.5); } else hurtPlayer(6 + Math.random() * 4); }
    }
  }
}
// Pickups: ammo (green), cash (gold), health (white cross box).
export function spawnPickup(x, z, type) {
  const colors = { ammo: 0x53ae62, cash: 0xffc93c, health: 0xf2f2f2 };
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55),
    new THREE.MeshStandardMaterial({ color: colors[type] || 0xffffff, emissive: colors[type] || 0xffffff, emissiveIntensity: 0.35 }));
  m.position.set(x, 0.8, z); G.scene.add(m);
  G.pickups.push({ mesh: m, x, z, type, t: Math.random() * 6 });
}
export function updatePickups(dt) {
  const p = G.player; if (!p) return;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i]; pk.t += dt;
    pk.mesh.rotation.y += dt * 2.4; pk.mesh.position.y = 0.8 + Math.sin(pk.t * 3) * 0.15;
    if (!p.inCar && dist2d(p.pos.x, p.pos.z, pk.x, pk.z) < 1.7) {
      if (pk.type === 'ammo') { p.reserve += 24; if (G.toast) G.toast('Ammo +24'); }
      if (pk.type === 'cash') { G.cash += 60; if (G.toast) G.toast('+$60'); sfx.cash(); }
      if (pk.type === 'health') { p.health = clamp(p.health + 35, 0, 100); if (G.toast) G.toast('Health +35'); }
      if (pk.type !== 'cash') sfx.pickup();
      G.scene.remove(pk.mesh); G.pickups.splice(i, 1);
    }
  }
}
