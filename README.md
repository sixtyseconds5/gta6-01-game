# Vice Rush

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Sixtyseconds5/gta6-01-game/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Sixtyseconds5/gta6-01-game/reward.svg)](https://make.fun/c/gta6-01)

A 3D open-world crime game in the spirit of GTA 6, built for the
[make.fun "Make GTA 6" bounty](https://make.fun/c/gta6-01) — a complete
sun-soaked coastal city rendered in WebGL (three.js, vendored locally) that
you can explore on foot and by car, with traffic, pedestrians, police,
missions and a story of your own. Everything is original: the city of
Vice City, its districts, its characters and its story were made for this game.
No Rockstar content, no network requests, no build step.

## The game

You are **Vic Vega**, fresh out of the joint and broke in Vice City. Rico has
jobs for you — wheels, packages, and one very loud night. Steal cars, dodge the
VCPD, and build your name, one mission at a time.

- **A 3D open world to explore** — a procedural street grid of districts
  (Downtown, Little Havana Row, Sunset Park, Ocean Drive, Northside, The
  Docks), a park and a beach with animated water, all in third person on foot
  or behind the wheel, under a sunset sky with long shadows.
- **Traffic and pedestrians** — cars cruise the roads and turn at
  intersections, people stroll the sidewalks and panic when the shooting starts.
- **Cars to steal and drive** — walk up to any car, press **E** to take it,
  and drive with **WASD**; sedans, sports cars, taxis, trucks, vans and
  police cruisers each handle differently, with crash shake, damage and
  explosions.
- **A wanted level (1–5 stars)** — stealing cars, hitting pedestrians or cops
  and shooting raise the heat; lay low and it fades. Police cruisers chase
  and ram you, roadblocks go up at 3+ stars, a searchlight helicopter hunts
  you at 4–5 stars, and on-foot cops try to arrest you when the heat is high.
- **Missions and a story** — six jobs with intro dialogue from Rico and
  Marisol, objectives, map markers, timers and cash rewards: *Hot Wheels*
  (steal a car, make the drop-off), *Package Run* (collect three packages,
  deliver the bag), *Lose the Heat* (shake a three-star wanted level and
  reach the hideout), *Taxi Nights* (three fares against the clock),
  *The Getaway* (timed escape from the Docks with helicopter pursuit),
  *King of Vice City* (clear the rival crew at the beachfront). Fail a
  mission and you can retry it; finish all six and the city is yours in free
  roam.
- **Combat** — mouse aim, click to shoot, with pistol, SMG and shotgun
  pickups, enemy health bars, muzzle flash, tracers and dropped cash.
- **Progression** — cash from missions, fares and pickups; a respect counter
  that grows with completed jobs; an Ammo-Nation store to restock ammo and a
  Sunset Garage safehouse to heal and repair.
- **Radio** — three synthesized WebAudio stations (VICE FM, Ocean Drive
  Radio, Havana Beats) with basslines and track names in the HUD, plus an
  engine hum that follows your speed, sirens, gunshots, crashes and a
  mission-pass jingle. **R** switches station, **M** mutes.
- **HUD** — health, cash, respect, wanted stars, a circular live minimap
  (player, cars, cops, enemies, mission marker), the current objective with
  stage progress (e.g. STAGE 2/3), a timer when it matters, a speedometer and
  car health while driving, district names on entry, and dialogue with a
  portrait.
- **Menus and saving** — a title screen with the story and controls, pause,
  BUSTED / WASTED screens with restart, and progress (cash, mission,
  position, respect) saved to localStorage after each mission, with a
  continue option.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser and play with keyboard
and mouse (click the game once to lock the mouse for aiming).

## Layout

- `game/index.html` — the page, HUD markup and the three.js import map.
- `game/vendor/three.module.min.js` — vendored three.js r160 (minified build;
  the transcript gate counts only non-`.min.js` files, and r160 is the last
  release shipping a self-contained `three.module.min.js`).
- `game/src/config.js` — tuning numbers, car types, districts, places, weapons.
- `game/src/world.js` — the city: street grid, instanced buildings with
  canvas window textures, palms, lamps, billboards, beach, water, sky, sun.
- `game/src/vehicles.js` — low-poly car meshes and arcade driving physics.
- `game/src/traffic.js` — traffic cars cruising the road grid.
- `game/src/pedestrians.js` — sidewalk pedestrians that panic and flee.
- `game/src/police.js` — cruisers, roadblocks, the searchlight helicopter,
  on-foot cops.
- `game/src/combat.js` — hitscan weapons, tracers, particles, pickups,
  rival-crew enemies.
- `game/src/missions.js` — the six story jobs, stages, markers and rewards.
- `game/src/hud.js` — HUD, minimap, dialogue, toasts, menus.
- `game/src/audio.js` — synthesized WebAudio: radio stations, engine, siren,
  effects.
- `game/src/input.js` — keyboard and mouse (pointer lock).
- `game/src/save.js` — localStorage save / load.
- `game/src/shots.js` — deterministic `?shot=chase|drive|foot|mission`
  scenes for screenshots.
- `game/src/main.js` — boot, the game loop, player + camera, wanted heat,
  interactions, BUSTED / WASTED flow.
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`.
- `screenshots/` — four real renders of the game, taken in headless Chromium.

## Screenshots

1. `1-chase.jpg` — sunset police chase: 4 stars, helicopter, cruisers,
   mission panel, dialogue, minimap.
2. `2-drive.jpg` — driving downtown in traffic.
3. `3-foot.jpg` — on foot on Ocean Drive with pedestrians and the rival crew.
4. `4-mission.jpg` — the Package Run mission in progress.

## License

MIT — see [LICENSE](LICENSE).
