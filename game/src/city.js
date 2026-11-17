// PALMA HEAT — Bahía Palma: deterministic road-grid city, bay, marina, POIs.
import * as THREE from 'three';
import { CFG, ROADS, G, POI_DEFS, clamp } from './config.js';
import { mulberry32, rngRange, rngPick, rngInt } from './rng.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}
function buildingTexture(rng, base) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 8; y += 22) for (let x = 10; x < w - 12; x += 24) {
      const lit = rng() < 0.42;
      g.fillStyle = lit ? (rng() < 0.5 ? '#ffd97a' : '#fff3c4') : '#2b3a44';
      g.fillRect(x, y, 14, 12);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, 14, 3);
    }
  });
}
function signTexture(text, bg, fg) {
  return canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.font = 'bold 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 2);
  });
}
function groundTexture() {
  const S = 2048, W2 = 250, sc = S / (W2 * 2);
  const toPx = (v) => (v + W2) * sc;
  return canvasTex(S, S, (g) => {
    g.fillStyle = '#8f9296'; g.fillRect(0, 0, S, S); // sidewalk concrete
    // Blocks: warm plaza / grass variation between streets.
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
      const cx = -168 + i * 42, cz = -168 + j * 42;
      g.fillStyle = ['#7d9b6a', '#a49a83', '#96908a', '#86a174'][(i * 9 + j) % 4];
      g.fillRect(toPx(cx - 14), toPx(cz - 14), 28 * sc, 28 * sc);
    }
    // Roads: asphalt strips with centre dashes and edge lines.
    g.fillStyle = '#33373c';
    for (const r of ROADS) { g.fillRect(toPx(r - 7), 0, 14 * sc, S); g.fillRect(0, toPx(r - 7), S, 14 * sc); }
    g.strokeStyle = '#e8c85a'; g.lineWidth = 3; g.setLineDash([18, 16]);
    for (const r of ROADS) {
      g.beginPath(); g.moveTo(toPx(r), 0); g.lineTo(toPx(r), S); g.stroke();
      g.beginPath(); g.moveTo(0, toPx(r)); g.lineTo(S, toPx(r)); g.stroke();
    }
    g.setLineDash([]); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2;
    for (const r of ROADS) for (const o of [-6.4, 6.4]) {
      g.beginPath(); g.moveTo(toPx(r + o), 0); g.lineTo(toPx(r + o), S); g.stroke();
      g.beginPath(); g.moveTo(0, toPx(r + o)); g.lineTo(S, toPx(r + o)); g.stroke();
    }
    // Beach + bay painted into the south edge.
    g.fillStyle = '#e6cf9a'; g.fillRect(0, toPx(CFG.beachZ), S, toPx(CFG.bayZ) - toPx(CFG.beachZ));
    g.fillStyle = '#2e7fa8'; g.fillRect(0, toPx(CFG.bayZ), S, S - toPx(CFG.bayZ));
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 60; i++) g.fillRect((i * 173) % S, toPx(CFG.bayZ) + (i * 37) % 90, 40, 3);
    // Docks apron (south-west) and marina apron (south-east).
    g.fillStyle = '#7a6a55'; g.fillRect(toPx(-196), toPx(160), toPx(-84) - toPx(-196), toPx(196) - toPx(160));
    g.fillStyle = '#6d6d72'; g.fillRect(toPx(84), toPx(150), toPx(196) - toPx(84), toPx(196) - toPx(150));
  });
}
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05, ...opts });
function box(scene, w, h, d, x, y, z, material, collide = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true; scene.add(m);
  if (collide) G.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  return m;
}
function palm(scene, x, z, rng) {
  const g = new THREE.Group(); const lean = rngRange(rng, -0.09, 0.09);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 5.4, 6), mat(0x8a6a48));
  trunk.position.y = 2.7; trunk.rotation.z = lean; g.add(trunk);
  const frondMat = mat(0x3f8f4f);
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.6, 4), frondMat);
    const a = (i / 5) * Math.PI * 2;
    f.position.set(Math.cos(a) * 1.1 + lean * 5, 5.7, Math.sin(a) * 1.1);
    f.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15 + Math.PI);
    f.scale.y = 1; g.add(f);
  }
  g.position.set(x, 0, z); scene.add(g);
  G.colliders.push({ x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4 });
}
function streetLight(scene, x, z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.6, 5), mat(0x3c4147));
  pole.position.set(x, 2.8, z); scene.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffc46b, emissiveIntensity: 1.6 }));
  bulb.position.set(x, 5.7, z); scene.add(bulb);
}
export function buildCity(scene) {
  const rng = mulberry32(CFG.seed * 7919 + 13);
  // Sky, sun, fog — golden hour.
  scene.background = new THREE.Color(0xf7b267);
  scene.fog = new THREE.Fog(0xf2a56b, 120, 430);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 16, 10), new THREE.MeshBasicMaterial({
    side: THREE.BackSide, fog: false,
    map: canvasTex(64, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#3d6fb4'); gr.addColorStop(0.45, '#e8906f'); gr.addColorStop(0.72, '#ffc978'); gr.addColorStop(1, '#ffe3ae');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }),
  }));
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(-140, 130, -80); scene.add(sun); G.sun = sun;
  scene.add(new THREE.HemisphereLight(0xffe0b8, 0x4a5a68, 0.95));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // Open water plane beyond the painted shore.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 300), mat(0x2e7fa8, { roughness: 0.35, metalness: 0.25 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.25, CFG.bayZ + 150); scene.add(water); G.water = water;

  const palettes = ['#c96f4a', '#b8b0a4', '#7fa3b8', '#d9c08a', '#9a7fa8', '#a8574c', '#8fae94', '#c2c7cc'];
  const texes = palettes.map((p) => buildingTexture(rng, p));
  const blockCenters = []; for (let i = 0; i < 9; i++) blockCenters.push(-168 + i * 42);
  const poiBlocks = new Set(POI_DEFS.map((p) => `${Math.round((p.x + 168) / 42)},${Math.round((p.z + 168) / 42)}`));
  for (let bi = 0; bi < 9; bi++) for (let bj = 0; bj < 9; bj++) {
    const cx = blockCenters[bi], cz = blockCenters[bj];
    if (cz >= 150) continue; // beach / marina / docks rows stay open
    if (poiBlocks.has(`${bi},${bj}`)) continue;
    const n = rngInt(rng, 1, 3);
    for (let k = 0; k < n; k++) {
      const w = rngRange(rng, 9, 15), d = rngRange(rng, 9, 15), h = rngRange(rng, 10, 42);
      const ox = n === 1 ? 0 : rngRange(rng, -7, 7), oz = n === 1 ? 0 : rngRange(rng, -7, 7);
      // Keep clear of the bank plot and the hideout warehouse, which are
      // placed on street corners rather than block centres.
      const bx = cx + ox, bz = cz + oz;
      if (bx + w / 2 > 2 && bx - w / 2 < 40 && bz + d / 2 > -78 && bz - d / 2 < -48) continue;
      if (bx + w / 2 > 168 && bz - d / 2 < -172) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ map: texes[rngInt(rng, 0, texes.length - 1)], roughness: 0.95 }));
      m.position.set(cx + ox, h / 2, cz + oz); scene.add(m);
      G.colliders.push({ x0: cx + ox - w / 2, x1: cx + ox + w / 2, z0: cz + oz - d / 2, z1: cz + oz + d / 2 });
      box(scene, w + 1, 0.7, d + 1, cx + ox, h + 0.3, cz + oz, mat(0x5a5148));
    }
    if (rng() < 0.6) palm(scene, cx + rngRange(rng, -12, 12), cz + 13.2, rng);
  }
  // POI buildings + signs.
  for (const def of POI_DEFS) {
    G.pois[def.id] = { ...def };
    if (def.id === 'hideout') { // just a shuttered warehouse corner + sign
      box(scene, 16, 7, 12, def.x - 6, 3.5, def.z + 4, mat(0x6a6258), true);
    } else if (def.id === 'docks' || def.id === 'marina') {
      // open lots: no main building (their props are added below)
    } else if (def.id === 'bank') {
      buildBank(scene, def);
    } else {
      const h = def.id === 'hospital' ? 20 : 11;
      const m = new THREE.Mesh(new THREE.BoxGeometry(22, h, 18),
        new THREE.MeshStandardMaterial({ map: texes[rngInt(rng, 0, texes.length - 1)], roughness: 0.95 }));
      m.position.set(def.x, h / 2, def.z); scene.add(m);
      G.colliders.push({ x0: def.x - 11, x1: def.x + 11, z0: def.z - 9, z1: def.z + 9 });
    }
    if (def.id !== 'docks') {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(15, 2.8),
        new THREE.MeshBasicMaterial({ map: signTexture(def.name.toUpperCase(), '#20242c', '#ffd97a'), side: THREE.DoubleSide }));
      sign.position.set(def.x, 6.4, def.z + 10.5); scene.add(sign);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.4, 5), mat(0x333333));
      post.position.set(def.x - 6, 3.2, def.z + 10.5); scene.add(post);
      const post2 = post.clone(); post2.position.x = def.x + 6; scene.add(post2);
    }
  }
  buildDocks(scene, rng); buildMarina(scene, rng);
  // Palms along the beach and lights at intersections.
  for (let x = -190; x <= 190; x += 19) palm(scene, x + rngRange(rng, -3, 3), 172 + rngRange(rng, 0, 4), rng);
  for (const rx of ROADS) for (const rz of ROADS) if ((Math.round(rx / 42) + Math.round(rz / 42)) % 2 === 0) streetLight(scene, rx + 8, rz + 8);
  return { blockCenters };
}
function buildBank(scene, def) {
  // Facade with a real doorway gap, lobby behind it, vault at the back.
  const wall = mat(0xd9c08a);
  box(scene, 9, 10, 1.6, def.x - 8.5, 5, def.z + 9, wall, true);
  box(scene, 9, 10, 1.6, def.x + 8.5, 5, def.z + 9, wall, true);
  box(scene, 8, 3.4, 1.6, def.x, 8.3, def.z + 9, wall, true); // lintel over the door
  box(scene, 1.6, 10, 19, def.x - 13, 5, def.z, wall, true);
  box(scene, 1.6, 10, 19, def.x + 13, 5, def.z, wall, true);
  box(scene, 27, 10, 1.6, def.x, 5, def.z - 9.5, wall, true);
  box(scene, 27, 1, 20, def.x, 10.4, def.z, mat(0x8a7648)); // roof slab (no collider: walk under it)
  const floor = box(scene, 26, 0.2, 19, def.x, 0.1, def.z, mat(0xb8a888));
  floor.receiveShadow = true;
  box(scene, 10, 1.1, 1.4, def.x, 0.55, def.z + 2, mat(0x6a4a2e), true); // counter
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.5, 20), mat(0x9aa2ac, { metalness: 0.7, roughness: 0.35 }));
  vault.rotation.x = Math.PI / 2; vault.position.set(def.x, 2.4, def.z - 8.4); scene.add(vault);
  G.bankVault = { x: def.x, z: def.z - 6.4 };
  G.bankDoor = { x: def.x, z: def.z + 9 };
}
function buildDocks(scene, rng) {
  const contCols = [0xc94f38, 0x3f7fbf, 0x4fae62, 0xd9a441, 0x7a5fb0];
  for (let i = 0; i < 14; i++) {
    const x = -190 + (i % 7) * 15, z = 166 + Math.floor(i / 7) * 13, c = rngPick(rng, contCols);
    box(scene, 11, 3, 5, x, 1.5, z, mat(c), true);
    if (rng() < 0.5) box(scene, 11, 3, 5, x, 4.5, z, mat(rngPick(rng, contCols)), true);
  }
  for (const cx of [-176, -118]) { // cranes
    box(scene, 1.6, 17, 1.6, cx, 8.5, 182, mat(0xd97c2e), true);
    box(scene, 20, 1.4, 1.4, cx + 8, 16.6, 182, mat(0xd97c2e));
    box(scene, 0.3, 7, 0.3, cx + 16, 12.5, 182, mat(0x444444));
  }
  for (let i = 0; i < 4; i++) box(scene, 4, 1, 26, -186 + i * 26, 0.5, 208, mat(0x8a6f4d)); // piers
}
function buildMarina(scene, rng) {
  box(scene, 100, 0.25, 42, 140, 0.12, 172, mat(0x66666c)); // marina lot tarmac
  for (let i = 0; i < 5; i++) { // finger docks + simple boats
    box(scene, 3, 0.8, 30, 96 + i * 22, 0.4, 210, mat(0x8a6f4d));
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 8), mat(i % 2 ? 0xf2f2f2 : 0x53b7e0));
    hull.position.y = 0.4; boat.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 3), mat(0xdadada)); cab.position.set(0, 1.3, -0.6); boat.add(cab);
    boat.position.set(100 + i * 22, 0, 206); scene.add(boat);
  }
  for (let i = 0; i < 6; i++) palm(scene, 92 + i * 19, 154, rng);
}
// A glowing gold objective column the player can see across the city.
export function makeMarker(scene, x, z, color = 0xffc93c) {
  const grp = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 13; grp.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 8, 24),
    new THREE.MeshBasicMaterial({ color }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.25; grp.add(ring);
  grp.position.set(x, 0, z); scene.add(grp);
  const m = { grp, ring, beam, set(x2, z2) { grp.position.set(x2, 0, z2); }, show(v) { grp.visible = v; } };
  G.markers.push(m); return m;
}
export function updateMarkers(dt) {
  for (const m of G.markers) if (m.grp.visible) { m.ring.rotation.z += dt * 1.6; m.beam.material.opacity = 0.28 + Math.sin(G.elapsed * 3) * 0.08; }
}
export { clamp };
