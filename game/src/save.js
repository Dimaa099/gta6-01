// PALMA HEAT — localStorage save/load (key palmaheat-save-v1).
import { CFG, G } from './config.js';
export function hasSave() { try { return !!localStorage.getItem(CFG.saveKey); } catch (e) { return false; } }
export function saveGame(reason) {
  if (!G.player) return false;
  const p = G.player;
  const data = {
    v: 1, cash: G.cash, missionIndex: G.mission ? G.mission.index : 0,
    storyDone: G.mission ? !!G.mission.storyDone : false,
    x: p.pos.x, z: p.pos.z, yaw: p.yaw, health: p.health,
    bestRaces: G.race ? G.race.best : {}, packagesDone: G.packages ? G.packages.done : 0,
    reason: reason || 'manual', at: Date.now(),
  };
  try { localStorage.setItem(CFG.saveKey, JSON.stringify(data)); return true; } catch (e) { return false; }
}
export function loadSave() {
  try { const raw = localStorage.getItem(CFG.saveKey); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
export function clearSave() { try { localStorage.removeItem(CFG.saveKey); } catch (e) {} }
export function applySave(d) {
  if (!d || !G.player) return;
  G.cash = d.cash | 0;
  G.player.pos.x = +d.x || 0; G.player.pos.z = +d.z || 0;
  G.player.yaw = +d.yaw || 0; G.player.health = Math.max(30, +d.health || 100);
  if (G.mission) { G.mission.index = d.missionIndex | 0; G.mission.storyDone = !!d.storyDone; G.mission.stage = 'idle'; }
  if (G.race && d.bestRaces) G.race.best = d.bestRaces;
  if (G.packages) G.packages.done = d.packagesDone | 0;
}
