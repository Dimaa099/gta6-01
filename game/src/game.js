// PALMA HEAT — game orchestrator: renderer, fixed-step loop, input, menus,
// particles, crime wiring, respawns, and the window.__palma test hooks.
import * as THREE from 'three';
import { CFG, G, poi, clamp, dist2d } from './config.js';
import { mulberry32 } from './rng.js';
import { initAudio, setMuted, engineSound, sfx } from './audio.js';
import { buildCity, updateMarkers } from './city.js';
import { spawnTraffic, spawnParked, updateTrafficCar } from './vehicles.js';
import { spawnPeds, updatePed, scarePeds, makeHuman } from './pedestrians.js';
import { createPlayer, updatePlayer, updateCamera, nearestCar, enterCar, exitCar, healPlayer } from './player.js';
import { fireGun, melee, updateNPC, updatePickups, updateTracers, spawnPickup } from './combat.js';
import { crime, setWanted, clearWanted, updatePolice } from './police.js';
import { initMissions, startStory, updateMissions, missionRespawn, onEnterCarHook, tryStartRace, missionState, missionCars } from './missions.js';
import { initHUD, updateHUD } from './hud.js';
import { hasSave, saveGame, loadSave, applySave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
if (params.get('seed')) CFG.seed = parseInt(params.get('seed'), 10) || 1;
const rng = mulberry32(CFG.seed * 104729 + 7);

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12; // warm colour grade
document.getElementById('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(60, 26, 235); camera.lookAt(0, 4, 120);
G.scene = scene; G.camera = camera; G.renderer = renderer;
G.tracers = [];
G.flashLight = new THREE.PointLight(0xffc46b, 0, 18); G.flashLight.position.y = 2; scene.add(G.flashLight);

buildCity(scene);
createPlayer(scene);
spawnTraffic(scene, 14, rng);
spawnParked(scene, rng);
spawnPeds(scene, 30, rng);
initMissions(scene);
G.missionCars = missionCars();
initHUD();
for (let i = 0; i < 5; i++) spawnPickup(-180 + i * 30, 60 - i * 22, i % 2 ? 'ammo' : 'health');

// ---------- particles (skid smoke, exhaust, crash puffs) ----------
const particles = [];
{
  const geo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  for (let i = 0; i < 130; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0 }));
    m.visible = false; scene.add(m);
    particles.push({ m, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
  }
}
let pIdx = 0;
function puff(x, y, z, color, n, spread = 1.6, up = 1.2) {
  for (let i = 0; i < n; i++) {
    const p = particles[pIdx++ % particles.length];
    p.m.visible = true; p.m.material.color.setHex(color); p.m.material.opacity = 0.55;
    p.m.position.set(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5));
    p.vx = (Math.random() - 0.5) * spread; p.vz = (Math.random() - 0.5) * spread; p.vy = Math.random() * up;
    p.life = p.max = 0.5 + Math.random() * 0.6;
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    if (!p.m.visible) continue;
    p.life -= dt;
    if (p.life <= 0) { p.m.visible = false; continue; }
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    p.m.material.opacity = 0.55 * (p.life / p.max);
    const s = 1 + (1 - p.life / p.max) * 1.6; p.m.scale.setScalar(s);
  }
}

// ---------- cross-module wiring ----------
G.crime = crime; G.setWanted = setWanted; G.clearWanted = clearWanted;
G.mission = G.mission; // (initMissions already set it)
if (G.mission) G.mission.onEnterCar = onEnterCarHook;
G.onCarCrash = (car, speed) => {
  G.shake = Math.min(0.6, speed * 0.02); puff(car.pos.x, 1, car.pos.z, 0x999999, 8);
  if (car.role === 'player') { scarePeds(car.pos.x, car.pos.z, 14); if (G.toast) G.toast('Crash! Car health ' + Math.max(0, Math.round(car.health)) + '%'); }
};
G.onDriverFlee = (x, z) => {
  const h = makeHuman(scene, {});
  const ped = { ...h, axis: 'x', dir: 1, road: 0, side: 10, speed: 1.6, fleeT: 3.4, fleeFrom: { x, z }, dead: false };
  ped.pos.set(x + 1.6, 0, z + 1); G.peds.push(ped);
  scarePeds(x, z, 10);
};
G.onBusted = () => {
  if (G.mode !== 'play') return;
  G.mode = 'busted'; exitLock();
  document.getElementById('busted').style.display = 'flex';
  sfx.fail();
};
G.onStoryEnd = () => {
  G.mode = 'end'; exitLock();
  document.getElementById('endcard').style.display = 'flex';
};

// ---------- menus / flow ----------
const $ = (id) => document.getElementById(id);
function showTitle() {
  G.mode = 'title';
  $('title').style.display = 'flex'; $('hud').style.display = 'none';
  $('btn-continue').disabled = !hasSave();
  $('btn-continue').style.opacity = hasSave() ? 1 : 0.45;
}
function startGame(useSave) {
  initAudio();
  if (useSave) { const d = loadSave(); if (d) applySave(d); }
  G.mode = 'play'; G.started = true;
  $('title').style.display = 'none'; $('hud').style.display = 'block';
  $('pause').style.display = 'none';
  startStory();
  if (useSave && G.toast) G.toast('Save loaded');
}
function respawnAt(place) {
  const p = G.player, spot = poi(place);
  if (p.inCar) { p.inCar.role = 'parked'; p.inCar = null; p.grp.visible = true; }
  p.pos.set(spot.x, 0, spot.z + 14); p.health = 100; p.dead = false;
  clearWanted(); missionRespawn();
  G.mode = 'play';
  $('busted').style.display = 'none'; $('dead').style.display = 'none';
}
$('btn-new').addEventListener('click', () => startGame(false));
$('btn-continue').addEventListener('click', () => startGame(true));
$('btn-how').addEventListener('click', () => { $('how').style.display = $('how').style.display === 'block' ? 'none' : 'block'; });
$('btn-mute').addEventListener('click', (e) => { initAudio(); setMuted(!G.muted); e.target.textContent = G.muted ? '🔇 Sound: Off' : '🔊 Sound: On'; });
$('btn-resume').addEventListener('click', () => { G.mode = 'play'; $('pause').style.display = 'none'; });
$('btn-save').addEventListener('click', () => { if (saveGame('pause-menu') && G.toast) G.toast('Saved'); });
$('btn-load').addEventListener('click', () => { const d = loadSave(); if (d) { applySave(d); G.mode = 'play'; $('pause').style.display = 'none'; } });
$('btn-restart').addEventListener('click', () => { clearSave(); location.reload(); });
$('btn-quit').addEventListener('click', () => { saveGame('quit'); location.reload(); });
$('btn-respawn-busted').addEventListener('click', () => { const fine = Math.min(G.cash, 200); G.cash -= fine; if (G.toast) G.toast('Fine paid: $' + fine); respawnAt('police'); });
$('btn-respawn-dead').addEventListener('click', () => { G.cash = Math.floor(G.cash * 0.9); respawnAt('hospital'); });
$('btn-freeroam').addEventListener('click', () => { $('endcard').style.display = 'none'; G.mode = 'play'; });
function togglePause() {
  if (G.mode === 'play') { G.mode = 'paused'; $('pause').style.display = 'flex'; exitLock(); }
  else if (G.mode === 'paused') { G.mode = 'play'; $('pause').style.display = 'none'; }
}
function exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

// ---------- input ----------
const inp = G.input;
addEventListener('keydown', (e) => {
  inp.keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (G.mode !== 'play') { if (e.code === 'KeyP' || e.code === 'Escape') togglePause(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (e.code === 'KeyM') { initAudio(); setMuted(!G.muted); if (G.toast) G.toast(G.muted ? 'Muted' : 'Sound on'); }
  if (e.code === 'KeyR') { const p = G.player; if (p.mag < 12 && p.reserve > 0 && p.reloading <= 0) { p.reloading = 1.1; sfx.empty(); } }
  if (e.code === 'KeyF') melee();
  if (e.code === 'KeyH' && G.player.inCar) { sfx.horn(); scarePeds(G.player.pos.x, G.player.pos.z, 9); }
  if (e.code === 'KeyE' && !e.repeat) interact();
});
addEventListener('keyup', (e) => { inp.keys[e.code] = false; });
function interact() {
  const p = G.player;
  if (p.inCar) { if (!tryStartRace()) exitCar(); return; }
  const car = nearestCar(4.2);
  if (car) { enterCar(car); return; }
  const gp = poi('garage');
  if (dist2d(p.pos.x, p.pos.z, gp.x, gp.z + 12) < 6) { if (saveGame('safehouse')) G.toast('💾 Saved at Vega’s Garage'); return; }
  const hp = poi('hospital');
  if (dist2d(p.pos.x, p.pos.z, hp.x, hp.z + 12) < 6 && p.health < 100) {
    if (G.cash >= 25) { G.cash -= 25; healPlayer(100); G.toast('Patched up · −$25'); sfx.cash(); } else G.toast('Need $25 to get patched up');
  }
}
renderer.domElement.addEventListener('click', () => {
  initAudio();
  if (G.mode === 'play' && !G.shotName) renderer.domElement.requestPointerLock();
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === renderer.domElement) {
    inp.locked = true;
    G.camYaw -= e.movementX * 0.0031; G.camPitch = clamp(G.camPitch + e.movementY * 0.0026, -0.12, 1.0);
  } else if (inp.dragging) {
    G.camYaw -= (e.clientX - inp.mx) * 0.005; G.camPitch = clamp(G.camPitch + (e.clientY - inp.my) * 0.004, -0.12, 1.0);
    inp.mx = e.clientX; inp.my = e.clientY;
  }
});
addEventListener('mousedown', (e) => {
  if (e.target !== renderer.domElement) return;
  inp.dragging = true; inp.mx = e.clientX; inp.my = e.clientY;
  if (e.button === 0) inp.fire = true;
});
addEventListener('mouseup', (e) => { inp.dragging = false; if (e.button === 0) inp.fire = false; });
document.addEventListener('pointerlockchange', () => { inp.locked = document.pointerLockElement === renderer.domElement; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- simulation tick (fixed 1/120 s) ----------
let hudT = 0, smokeT = 0;
function tick(dt) {
  G.elapsed += dt; G.time += dt;
  const p = G.player;
  if (G.mode === 'play') {
    G.interactLabel = '';
    updatePlayer(dt);
    if (inp.fire) fireGun();
    updateMissions(dt);
    // Context interaction prompt when the mission didn't set one.
    if (!G.interactLabel) {
      if (p.inCar) G.interactLabel = 'E — exit car · Space — handbrake · H — horn';
      else {
        const car = nearestCar(4.2);
        if (car) G.interactLabel = 'E — ' + (car.role === 'traffic' ? 'STEAL' : 'drive') + ' the ' + car.kind;
        else {
          const gp = poi('garage'), hp = poi('hospital');
          if (dist2d(p.pos.x, p.pos.z, gp.x, gp.z + 12) < 6) G.interactLabel = 'E — save at the safehouse';
          else if (dist2d(p.pos.x, p.pos.z, hp.x, hp.z + 12) < 6) G.interactLabel = 'E — get patched up ($25)';
          else if (G.packages.at && dist2d(p.pos.x, p.pos.z, G.packages.at.x, G.packages.at.z) < 6) G.interactLabel = 'Walk to the green marker — package pickup';
        }
      }
    }
    // Cars vs pedestrians, and traffic vs the player on foot.
    for (const car of G.cars) {
      if (Math.abs(car.speed) < 4 || car.dead) continue;
      for (const ped of G.peds) {
        if (ped.dead) continue;
        if (dist2d(car.pos.x, car.pos.z, ped.pos.x, ped.pos.z) < 1.5) {
          ped.dead = true; ped.grp.rotation.x = -Math.PI / 2; ped.grp.position.y = 0.25;
          scarePeds(ped.pos.x, ped.pos.z, 16);
          if (car.role === 'player') { crime('pedhit'); G.toast('You hit a pedestrian!'); }
        }
      }
      if (!p.inCar && car.role === 'traffic' && dist2d(car.pos.x, car.pos.z, p.pos.x, p.pos.z) < 1.6) {
        p.health -= 18; G.flash = 0.8; if (p.health <= 0) { p.health = 0; p.dead = true; }
      }
    }
    if (p.dead && G.mode === 'play') { G.mode = 'dead'; $('dead').style.display = 'flex'; exitLock(); sfx.fail(); }
  }
  if (G.mode === 'play' || G.mode === 'title') {
    for (const c of G.traffic) updateTrafficCar(c, dt);
    for (const ped of G.peds) updatePed(ped, dt);
  }
  if (G.mode === 'play') {
    updatePolice(dt);
    for (const n of [...G.npcs]) updateNPC(n, dt);
    updatePickups(dt);
    // Exhaust + damage smoke + handbrake skids for the player's car.
    smokeT -= dt;
    if (p.inCar && smokeT <= 0) {
      smokeT = 0.06;
      const car = p.inCar, bx = car.pos.x - Math.sin(car.angle) * 2, bz = car.pos.z - Math.cos(car.angle) * 2;
      if (inp.keys.Space && Math.abs(car.speed) > 6) puff(bx, 0.3, bz, 0xdddddd, 2);
      else if (Math.abs(car.speed) > 3) puff(bx, 0.5, bz, 0x888888, 1);
      if (car.health < 45) puff(car.pos.x, 1.1, car.pos.z, 0x333333, 2);
    }
    for (const c of G.policeCars) if (c.health < 40 && Math.random() < 0.1) puff(c.pos.x, 1.1, c.pos.z, 0x333333, 1);
  }
  updateTracers(dt); updateParticles(dt); updateMarkers(dt);
  if (G.flashLight.intensity > 0) G.flashLight.intensity = Math.max(0, G.flashLight.intensity - dt * 260);
  if (!G.shotName && G.mode !== 'title') updateCamera(dt);
  hudT -= dt;
  if (hudT <= 0) { hudT = 1 / 20; if (G.mode !== 'title') updateHUD(1 / 20); }
}
// Real-time loop: accumulate into fixed ticks; title gets a slow orbit cam.
let last = performance.now(), acc = 0;
function animate(now) {
  requestAnimationFrame(animate);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (G.shotName) { renderer.render(scene, camera); return; }
  if (G.mode === 'title') {
    const t = now * 0.00004;
    camera.position.set(Math.sin(t) * 150, 42, Math.cos(t) * 150 + 40);
    camera.lookAt(0, 6, 30);
  }
  if (G.mode !== 'paused') { acc += dt; const stepDt = 1 / 120; let n = 0; while (acc >= stepDt && n < 14) { tick(stepDt); acc -= stepDt; n++; } }
  const p = G.player;
  engineSound(p && p.inCar ? p.inCar.speed / 30 : 0, !!(p && p.inCar));
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// ---------- shot staging / title ----------
const shot = params.get('shot');
if (shot) {
  if (shot !== 'title') { G.mode = 'play'; }
  stageShot(shot);
  if (shot !== 'title') updateHUD(0);
  renderer.render(scene, camera);
} else showTitle();

// ---------- test hooks ----------
function stateSnapshot() {
  const p = G.player, m = missionState();
  return {
    mode: G.mode, cash: G.cash, wanted: G.wanted, bust: G.bust,
    inCar: !!p.inCar, carSpeed: p.inCar ? p.inCar.speed : 0,
    health: p.health, mag: p.mag, reserve: p.reserve,
    missionId: m ? m.index : -1, missionStage: m ? m.stage : 'none', mission: m,
    storyDone: m ? m.storyDone : false,
    playerPos: { x: p.pos.x, y: p.pos.y, z: p.pos.z },
    player: { pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, health: p.health, inCar: !!p.inCar },
    police: G.policeCars.length, peds: G.peds.length, cars: G.cars.length,
    pos: { x: p.pos.x, z: p.pos.z },
  };
}
window.__palma = {
  get state() { return stateSnapshot(); },
  start() { if (!G.started) startGame(false); else if (G.mode === 'title') startGame(false); },
  step(n = 1) { for (let i = 0; i < n; i++) tick(1 / 120); if (!G.shotName) updateCamera(1 / 60); updateHUD(0); renderer.render(scene, camera); },
  crime(kind) { crime(kind || 'theft'); },
  save: () => saveGame('test'),
  player: G.player, G,
};
