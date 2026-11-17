// PALMA HEAT — staged, frozen screenshot scenes for ?shot=<name>&seed=1.
import { G, poi } from './config.js';
import { createCar } from './vehicles.js';
import { setWanted } from './police.js';
import { phone, setObjective } from './missions.js';
function cam(x, y, z, lx, ly, lz) {
  G.camera.position.set(x, y, z); G.camera.lookAt(lx, ly, lz);
}
function shotPolice(x, z, angle) {
  const car = createCar(G.scene, { kind: 'police', color: 0xf0f2f4, role: 'police', x, z, angle });
  car.group.userData.lights.rl.material.emissiveIntensity = 3;
  car.group.userData.lights.bl.material.emissiveIntensity = 3;
  G.policeCars.push(car); return car;
}
export function stageShot(name) {
  const p = G.player; if (!p) return;
  G.shotName = name;
  if (name === 'title') { // title screen floats over the bay at golden hour
    cam(60, 26, 235, 0, 4, 120); return;
  }
  G.mode = 'play'; G.started = true;
  const title = document.getElementById('title'); if (title) title.style.display = 'none';
  const hud = document.getElementById('hud'); if (hud) hud.style.display = 'block';
  if (name === 'chase') {
    const car = G.missionCars.vegaCar;
    car.pos.set(3, 0, -21); car.angle = Math.PI / 2; car.group.rotation.y = car.angle; car.speed = 19;
    p.inCar = car; car.role = 'player'; p.grp.visible = false; p.pos.set(3, 0, -21);
    shotPolice(-7, -24.2, Math.PI / 2); shotPolice(-9, -17.6, Math.PI / 2);
    setWanted(3); G.cash = 740;
    setObjective('M1 · Deliver the package to Vega’s Garage');
    phone('Heat’s on you, Marco — lose them or reach my Garage. GO.');
    cam(-19, 5.2, -21, 16, 1.1, -21);
  } else if (name === 'foot') {
    p.pos.set(8, 0, -10.5); p.yaw = 2.6; p.grp.rotation.y = p.yaw;
    G.camYaw = 0.4; G.camPitch = 0.25; G.cash = 260;
    setObjective('M1 · First Run — get in Vega’s sedan at the Garage');
    cam(1, 3.2, -3.5, 11, 1.2, -13);
  } else if (name === 'bank') {
    const b = poi('bank');
    p.pos.set(b.x + 2, 0, b.z + 14); p.yaw = Math.PI; p.grp.rotation.y = p.yaw;
    G.cash = 3910; setWanted(3);
    shotPolice(b.x + 13, b.z + 17, -0.5); shotPolice(b.x - 18, b.z + 26, 0.6);
    setObjective('M3 · Escape to the Hideout (NE corner)');
    phone('Three stars, Marco — the Hideout. DON’T stop.');
    cam(b.x - 7, 4.5, b.z + 27, b.x + 1, 1.6, b.z + 8);
  } else if (name === 'marina') {
    p.pos.set(121, 0, 171); p.yaw = 0.5; p.grp.rotation.y = p.yaw;
    G.cash = 620; setWanted(0);
    setObjective('M2 · Steal the orange Cometa GT (guards are armed)');
    phone('That orange GT, Marco. Guards too. Take it.');
    cam(109, 4.6, 186, 130, 1, 158);
  }
}
