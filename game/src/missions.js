// PALMA HEAT — Carmen Vega's 3-mission story chain, side packages, street races.
import { G, poi, dist2d } from './config.js';
import { makeMarker } from './city.js';
import { createCar } from './vehicles.js';
import { spawnNPC } from './combat.js';
import { setWanted } from './police.js';
import { sfx } from './audio.js';
import { saveGame } from './save.js';
export function phone(text, dur = 5.5) { G.dialogue = { from: 'Carmen “La Jefa” Vega — 📱', text, t: dur }; }
export function setObjective(t) { G.objective = t; }
let gold = null, green = null, cyan = null, vegaCar = null, gtCar = null, guards = [];
export const RACES = [
  { id: 'bay-run', name: 'Bay Run', start: { x: 21, z: 147 }, cps: [[21, 63], [105, 63], [105, -21], [21, -21]] },
  { id: 'downtown-loop', name: 'Downtown Loop', start: { x: -63, z: -63 }, cps: [[-63, 21], [21, 21], [21, -63], [-63, -63]] },
  { id: 'north-south', name: 'North–South Dash', start: { x: 147, z: -147 }, cps: [[147, -63], [147, 21], [147, 105], [147, 189]] },
];
export function initMissions(scene) {
  gold = makeMarker(scene, 0, 0, 0xffc93c); gold.show(false);
  green = makeMarker(scene, 0, 0, 0x53e08a); green.show(false);
  cyan = makeMarker(scene, 0, 0, 0x53c8e0); cyan.show(false);
  G.mission = { index: 0, stage: 'idle', storyDone: false, timer: 0, vaultHold: 0, started: false };
  G.packages = { done: 0, at: null };
  G.race = { best: {}, active: null, cp: 0, t: 0 };
  // Vega's sedan waits by the garage for M1.
  vegaCar = createCar(scene, { kind: 'sedan', color: 0x2fb3a8, role: 'mission', x: -157, z: -156, angle: Math.PI / 2 });
  // The orange Cometa GT at the Marina (M2 target) + its two armed guards.
  gtCar = createCar(scene, { kind: 'gt', color: 0xff7d2e, role: 'mission', x: 126, z: 162, angle: 0 });
  guards = [
    spawnNPC(scene, 122.5, 159, { kind: 'guard', shirt: 0x8f2f2f, health: 60, name: 'Marina guard' }),
    spawnNPC(scene, 129.5, 165, { kind: 'guard', shirt: 0x8f2f2f, health: 60, name: 'Marina guard' }),
  ];
  spawnPackage();
  return G.mission;
}
const PKG_SPOTS = [[31.5, -63], [-73.5, 21], [115.5, -21], [-115.5, -105], [157.5, 63], [-157.5, 21], [10.5, -147], [73.5, 147], [-73.5, -21], [157.5, -147]];
function spawnPackage() {
  const s = PKG_SPOTS[(Math.random() * PKG_SPOTS.length) | 0];
  G.packages.at = { x: s[0], z: s[1] };
  green.set(s[0], s[1]); green.show(true);
}
export function startStory() {
  const m = G.mission; if (!m || m.started) return;
  m.started = true;
  if (m.storyDone) { setObjective('Free roam — packages, races, or raise some heat.'); gold.show(false); return; }
  beginMission(m.index);
}
function beginMission(i) {
  const m = G.mission; m.index = i; m.vaultHold = 0;
  if (i === 0) {
    m.stage = 'toCar';
    phone('Marco. It’s Carmen. My teal sedan is outside the garage — take it to the Docks and pick up a package for me. Don’t scratch the paint.');
    setObjective('M1 · First Run — get in Vega’s sedan at the Garage');
    gold.set(-157, -156); gold.show(true);
  } else if (i === 1) {
    m.stage = 'toMarina';
    phone('Good boy. Next: an orange Cometa GT is sitting in the Marina lot. It has… guards. Take it. Bring it home, fast.');
    setObjective('M2 · Marina Muscle — go to the Marina lot');
    const mp = poi('marina'); gold.set(mp.x, mp.z); gold.show(true);
  } else if (i === 2) {
    m.stage = 'toBank';
    phone('Last job, Marco. Palma Trust Bank. Walk in, hold at the vault, take the cash — then vanish to the Hideout. Make me proud.');
    setObjective('M3 · Palma Trust — drive to Palma Trust Bank');
    const bp = poi('bank'); gold.set(bp.x, bp.z + 12); gold.show(true);
  }
}
function completeMission(reward, label) {
  G.cash += reward; sfx.sting(); sfx.cash();
  if (G.toast) G.toast(label + ' complete · +$' + reward);
  const m = G.mission;
  if (m.index >= 2) {
    m.storyDone = true; m.stage = 'done'; gold.show(false);
    setObjective('Story complete — free roam Bahía Palma');
    saveGame('story-complete');
    if (G.onStoryEnd) G.onStoryEnd();
    return;
  }
  m.index++; saveGame('mission-complete');
  beginMission(m.index);
}
export function missionRespawn() {
  const m = G.mission; if (!m || !m.started || m.storyDone) return;
  phone('Marco! Whatever went wrong — shake it off and run it again. — Carmen');
  beginMission(m.index);
}
function inGT() { return G.player.inCar === gtCar; }
export function updateMissions(dt) {
  const m = G.mission, p = G.player; if (!m || !p || !m.started) return;
  // Side package pickups (on foot).
  if (G.packages.at && !p.inCar && dist2d(p.pos.x, p.pos.z, G.packages.at.x, G.packages.at.z) < 2.2) {
    G.packages.done++; G.cash += 150; sfx.cash(); if (G.toast) G.toast('Package delivered · +$150');
    spawnPackage();
  }
  updateRace(dt);
  if (m.storyDone) return;
  const D = (x, z) => dist2d(p.pos.x, p.pos.z, x, z);
  if (m.stage === 'toCar') {
    if (p.inCar === vegaCar) { m.stage = 'toDocks'; phone('Wheels up. The package is on the Docks apron, marked gold. On foot to grab it — drivers don’t touch cargo.'); setObjective('M1 · Drive to the Docks, then grab the package on foot'); const dp = poi('docks'); gold.set(dp.x, 178); }
  } else if (m.stage === 'toDocks') {
    if (!p.inCar && D(poi('docks').x, 178) < 3.2) {
      m.stage = 'deliver'; setWanted(1); phone('You’ve got it. Heat’s noticed you — one star. Lose yourself back at my Garage. GO.');
      setObjective('M1 · Deliver the package to Vega’s Garage'); const gp = poi('garage'); gold.set(gp.x, gp.z + 12);
      if (G.toast) G.toast('Package picked up!');
    }
  } else if (m.stage === 'deliver') {
    if (D(poi('garage').x, poi('garage').z + 12) < 7) completeMission(500, 'M1 · First Run');
  } else if (m.stage === 'toMarina') {
    if (D(poi('marina').x, poi('marina').z) < 10) { m.stage = 'stealGT'; setObjective('M2 · Steal the orange Cometa GT (guards are armed)'); gold.set(126, 162); }
  } else if (m.stage === 'stealGT') {
    if (inGT()) startGTDelivery();
  } else if (m.stage === 'deliverGT') {
    m.timer -= dt;
    setObjective('M2 · Deliver the Cometa GT to the Garage — ' + Math.max(0, m.timer).toFixed(0) + 's');
    if (m.timer <= 0) { m.stage = 'stealGT'; phone('Too slow, Marco. The buyer walked. Get back in that GT and do it properly this time.'); setObjective('M2 · Get back in the Cometa GT'); gold.set(gtCar.pos.x, gtCar.pos.z); }
    else if (D(poi('garage').x, poi('garage').z + 12) < 7.5) completeMission(900, 'M2 · Marina Muscle');
  } else if (m.stage === 'toBank') {
    if (D(poi('bank').x, poi('bank').z + 12) < 6) { m.stage = 'vault'; phone('Inside. The vault is at the back of the lobby. Hold E at it and don’t let go.'); setObjective('M3 · Enter the bank and hold E at the vault'); gold.set(G.bankVault.x, G.bankVault.z); }
  } else if (m.stage === 'vault') {
    const near = D(G.bankVault.x, G.bankVault.z) < 3.4 && !p.inCar;
    G.interactLabel = near ? 'Hold E — cracking the vault… ' + Math.round(m.vaultHold / 3 * 100) + '%' : G.interactLabel;
    if (near && G.input.keys.KeyE) {
      m.vaultHold += dt;
      if (m.vaultHold >= 3) {
        m.stage = 'escape'; setWanted(3); G.cash += 0; phone('That’s my money walking out. Three stars, Marco — the Hideout, north-east corner. DON’T stop.');
        setObjective('M3 · Escape to the Hideout (NE corner)'); const hp = poi('hideout'); gold.set(hp.x - 9, hp.z + 9);
        if (G.toast) G.toast('Vault emptied — GO!');
      }
    } else m.vaultHold = Math.max(0, m.vaultHold - dt * 2);
  } else if (m.stage === 'escape') {
    if (D(poi('hideout').x - 9, poi('hideout').z + 9) < 8) { setWanted(0); if (G.clearWanted) G.clearWanted(); completeMission(2500, 'M3 · Palma Trust'); }
  }
}
function startGTDelivery() {
  const m = G.mission; m.stage = 'deliverGT'; m.timer = 95;
  setWanted(2); for (const g of guards) if (!g.dead) g.hostile = true;
  phone('Two stars and a ticking clock — the buyer waits 95 seconds. My Garage. MOVE.');
  setObjective('M2 · Deliver the Cometa GT to the Garage — 95s');
  const gp = poi('garage'); gold.set(gp.x, gp.z + 12);
}
export function onEnterCarHook(car) {
  const m = G.mission; if (!m || !m.started) return;
  if (m.stage === 'stealGT' && car === gtCar) startGTDelivery();
}
function updateRace(dt) {
  const r = G.race, p = G.player; if (!r) return;
  if (!r.active) { cyan.show(false); return; }
  const course = RACES.find((c) => c.id === r.active); if (!course) { r.active = null; return; }
  r.t += dt;
  const cp = course.cps[r.cp];
  cyan.set(cp[0], cp[1]); cyan.show(true);
  if (p.inCar && dist2d(p.pos.x, p.pos.z, cp[0], cp[1]) < 9) {
    sfx.checkpoint(); r.cp++;
    if (G.toast) G.toast('Checkpoint ' + r.cp + '/' + course.cps.length);
    if (r.cp >= course.cps.length) {
      const t = r.t, prev = r.best[course.id];
      if (!prev || t < prev) { r.best[course.id] = t; if (G.toast) G.toast(course.name + ' — NEW BEST ' + t.toFixed(1) + 's · +$75'); }
      else if (G.toast) G.toast(course.name + ' finished ' + t.toFixed(1) + 's (best ' + prev.toFixed(1) + 's) · +$75');
      G.cash += 75; sfx.cash(); r.active = null; cyan.show(false); saveGame('race');
    }
  }
}
export function tryStartRace() {
  const p = G.player; if (!p.inCar) return false;
  for (const c of RACES) if (dist2d(p.pos.x, p.pos.z, c.start.x, c.start.z) < 9 && !G.race.active) {
    G.race.active = c.id; G.race.cp = 0; G.race.t = 0;
    if (G.toast) G.toast('🏁 ' + c.name + ' started — follow the cyan markers');
    sfx.sting(); return true;
  }
  return false;
}
export function missionState() { const m = G.mission; return m ? { index: m.index, stage: m.stage, storyDone: m.storyDone } : null; }
export function missionCars() { return { vegaCar, gtCar }; }
