[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Dimaa099/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Dimaa099/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# PALMA HEAT

An original 3D open-world crime game set in the fictional sun-soaked bay city of **Bahía Palma**, built with three.js. You are **Marco Reyes**, a getaway driver working for crime boss **Carmen "La Jefa" Vega**.

Explore a deterministic ~9×9-block road-grid city at golden hour — lit-window buildings, palm trees, street lights, a beach, a bay with a marina (docks, boats), container docks with cranes, and named places: Vega's Garage (safehouse), Palma Trust Bank (with a walk-in lobby and vault), Marina lot, the Docks, Police Station, Hospital, and Palma Diner.

**Features**

- On-foot third-person play (mouse-orbit camera, sprint) and arcade driving in any car you can reach — parked or stolen (the driver bails and runs).
- Traffic AI on the road grid with lane following, intersection turns and avoidance; ~30 animated pedestrians who flee gunshots, fights and near-miss cars.
- Wanted system 0–5★: police cars spawn at the city edge and pursue; at 3★+ officers get out and shoot. Bust meter → BUSTED screen (fine, respawn at the Police Station); death → FLATLINED (respawn at the Hospital minus 10% cash). Heat decays when unobserved.
- Combat: hitscan pistol with tracers, muzzle flash, ammo and reloads, ammo pickups, F melee; armed guards and officers with health, hit reactions and deaths. Cars take damage and smoke.
- **3-mission story chain** with phone-text dialogue from Carmen, gold objective markers and minimap blips: *M1 First Run* (Docks package run, +$500), *M2 Marina Muscle* (steal the guarded orange Cometa GT against a timer, +$900), *M3 Palma Trust* (hold E at the bank vault, escape at 3★ to the Hideout, +$2,500, end card, free roam continues).
- Side activities: repeatable package pickups (+$150) and 3 checkpoint street-race courses with saved best times.
- Full HUD: canvas minimap (roads, water, player arrow, gold mission blip, flashing police blips, green package blips), cash, wanted stars, health, weapon/ammo, speedometer, objective banner, dialogue bar, prompts and toasts.
- Title screen, pause menu, and saving to `localStorage` (`palmaheat-save-v1`): cash, story progress, position and best race times; autosave on mission completion; save at the Garage safehouse.
- All sound is synthesised live with WebAudio (engine, sirens, gunshots, punches, pickups, mission stings, ambient pad) — no audio files. Skid/exhaust particles, damage smoke, muzzle-flash light and a warm colour grade.

## How to play

- **WASD** — move / drive · **Mouse** — look (click the game to pointer-lock, or drag) · **Shift** — sprint
- **E** — interact: enter/exit cars, save at Vega's Garage, heal at the Hospital, start a race (in a car at a cyan race start)
- **Mouse click** — fire pistol · **R** — reload · **F** — melee · **Space** — handbrake · **H** — horn
- **P / Esc** — pause · **M** — mute
- Follow the gold marker and Carmen's phone texts. Crimes raise your wanted stars; break line of sight to let heat cool down. Don't get caught slow with police close — the bust meter fills fast.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step and no network requests: the game is plain static files under `game/` with three.js vendored alongside.

<sub>Entered on [make.fun](https://make.fun/?ref=dimarz&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
