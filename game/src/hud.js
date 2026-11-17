// PALMA HEAT — HUD: minimap canvas, cash/stars/health/ammo, banners, toasts.
import { CFG, ROADS, G, poi } from './config.js';
const $ = (id) => document.getElementById(id);
let els = null, mmCtx = null;
export function initHUD() {
  els = {
    cash: $('cash'), stars: $('stars'), hpFill: $('hp-fill'), hpText: $('hp-text'),
    ammo: $('ammo'), speed: $('speed'), objective: $('objective'), dialogue: $('dialogue'),
    dlgFrom: $('dlg-from'), dlgText: $('dlg-text'), prompt: $('prompt'), toasts: $('toasts'),
    bustWrap: $('bust-wrap'), bustFill: $('bust-fill'), vignette: $('vignette'),
    race: $('race-info'), minimap: $('minimap'), cross: $('crosshair'),
  };
  mmCtx = els.minimap.getContext('2d');
  G.toast = (text) => {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = text;
    els.toasts.appendChild(d);
    setTimeout(() => { d.classList.add('fade'); setTimeout(() => d.remove(), 500); }, 3000);
    while (els.toasts.children.length > 4) els.toasts.firstChild.remove();
  };
}
export function updateHUD(dt) {
  if (!els) return;
  const p = G.player; if (!p) return;
  els.cash.textContent = '$' + G.cash.toLocaleString('en-US');
  els.stars.textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  els.stars.style.opacity = G.wanted ? 1 : 0.25;
  els.hpFill.style.width = Math.max(0, p.health) + '%';
  els.hpFill.style.background = p.health > 50 ? '#7ee2a8' : p.health > 25 ? '#ffc93c' : '#ff5a4e';
  els.hpText.textContent = Math.ceil(Math.max(0, p.health)) + '';
  els.ammo.textContent = p.reloading > 0 ? 'RELOADING…' : '🔫 ' + p.mag + ' / ' + p.reserve;
  if (p.inCar) {
    els.speed.style.display = 'block';
    els.speed.textContent = Math.round(Math.abs(p.inCar.speed) * 3.6) + ' km/h' + (p.inCar.health < 45 ? '  ·  💨 damage' : '');
    els.cross.style.display = 'none';
  } else { els.speed.style.display = 'none'; els.cross.style.display = G.mode === 'play' ? 'block' : 'none'; }
  els.objective.textContent = G.objective ? '🎯 ' + G.objective : '';
  els.objective.style.display = G.objective ? 'block' : 'none';
  if (G.dialogue && G.dialogue.t > 0) {
    G.dialogue.t -= dt;
    els.dialogue.style.display = 'block';
    els.dlgFrom.textContent = G.dialogue.from; els.dlgText.textContent = G.dialogue.text;
  } else els.dialogue.style.display = 'none';
  els.prompt.textContent = G.interactLabel || '';
  els.prompt.style.display = G.interactLabel ? 'block' : 'none';
  els.bustWrap.style.display = G.bust > 0.02 ? 'block' : 'none';
  els.bustFill.style.width = (G.bust * 100) + '%';
  G.flash = Math.max(0, G.flash - dt * 1.6);
  els.vignette.style.opacity = Math.min(0.85, G.flash + (p.health < 30 ? 0.3 : 0));
  if (G.race && G.race.active) {
    els.race.style.display = 'block';
    els.race.textContent = '🏁 ' + G.race.active + ' · ' + G.race.t.toFixed(1) + 's · checkpoint ' + (G.race.cp + 1);
  } else els.race.style.display = 'none';
  drawMinimap();
}
function w2m(x, z, S) { return [(x + 220) / 440 * S, (z + 220) / 440 * S]; }
function drawMinimap() {
  const c = mmCtx, S = els.minimap.width; if (!c) return;
  c.fillStyle = '#5d7355'; c.fillRect(0, 0, S, S);
  c.fillStyle = '#2e7fa8'; const [, wy] = w2m(0, CFG.bayZ, S); c.fillRect(0, wy, S, S - wy);
  c.fillStyle = '#e6cf9a'; const [, by] = w2m(0, CFG.beachZ, S); c.fillRect(0, by, S, wy - by);
  c.strokeStyle = '#3a3f45'; c.lineWidth = Math.max(2, S / 60);
  for (const r of ROADS) {
    const [x] = w2m(r, 0, S); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, S); c.stroke();
    const [, y] = w2m(0, r, S); c.beginPath(); c.moveTo(0, y); c.lineTo(S, y); c.stroke();
  }
  const dot = (x, z, color, r = 3) => { const [mx, my] = w2m(x, z, S); c.fillStyle = color; c.beginPath(); c.arc(mx, my, r, 0, 7); c.fill(); };
  if (G.packages && G.packages.at) dot(G.packages.at.x, G.packages.at.z, '#53e08a', 3);
  const gold = G.markers && G.markers[0];
  if (gold && gold.grp.visible) dot(gold.grp.position.x, gold.grp.position.z, '#ffc93c', 4.5);
  const race = G.markers && G.markers[2];
  if (race && race.grp.visible) dot(race.grp.position.x, race.grp.position.z, '#53c8e0', 4);
  const blink = Math.sin(G.elapsed * 9) > 0;
  for (const car of G.policeCars) dot(car.pos.x, car.pos.z, blink ? '#ff4444' : '#4488ff', 3.5);
  for (const n of G.npcs) if (!n.dead && (n.kind === 'officer' || n.hostile)) dot(n.pos.x, n.pos.z, '#ff6a5a', 2.5);
  for (const id of ['garage', 'bank', 'hospital', 'police']) { const q = poi(id); if (q) dot(q.x, q.z, 'rgba(255,255,255,.75)', 2); }
  // Player arrow.
  const p = G.player, [px, py] = w2m(p.pos.x, p.pos.z, S);
  const a = p.inCar ? p.inCar.angle : p.yaw;
  c.save(); c.translate(px, py); c.rotate(Math.atan2(Math.sin(a), -Math.cos(a)) + Math.PI);
  c.fillStyle = '#ffffff'; c.strokeStyle = '#111'; c.beginPath();
  c.moveTo(0, -6); c.lineTo(4.4, 5); c.lineTo(-4.4, 5); c.closePath(); c.fill(); c.stroke(); c.restore();
}
