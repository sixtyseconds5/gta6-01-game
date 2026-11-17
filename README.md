# Vice Rush

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Sixtyseconds5/gta6-01-game/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Sixtyseconds5/gta6-01-game/reward.svg)](https://make.fun/c/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the
[make.fun "Make GTA 6" bounty](https://make.fun/c/gta6-01) — a complete 2D
top-down city you can explore on foot and by car, with traffic, pedestrians,
police, missions and a story of your own. Everything is original: the city of
Vice City, its districts, its characters and its story were made for this game.
No Rockstar content, no network requests, no build step.

## The game

You are **Vic Vega**, fresh out of the joint and broke in Vice City. Rico has
jobs for you — wheels, packages, and one very loud night. Steal cars, dodge the
VCPD, and build your name, one mission at a time.

- **An open world to explore** — a street grid of districts (Downtown,
  Little Havana Row, Sunset Park, Ocean Drive, Northside, The Docks), a park
  and a beach with the water's edge, all on foot or behind the wheel.
- **Traffic and pedestrians** — cars cruise the roads, people stroll the
  sidewalks and panic when the shooting starts.
- **Cars to steal and drive** — walk up to any car, press **E** to take it,
  and drive with **WASD**; on-foot and driving handling feel different, with
  skid marks and screen shake on hard crashes.
- **A wanted level (1–5 stars)** — stealing cars, hitting pedestrians or cops
  and shooting raise the heat; lay low and it fades. Police cruisers chase
  and ram you, and on-foot cops try to arrest you when the heat is high.
- **Missions and a story** — three jobs with objectives, map markers, timers
  and cash rewards: *Hot Wheels* (steal a car, make the drop-off), *Package
  Run* (collect three packages, deliver the bag), *Lose the Heat* (shake a
  three-star wanted level and reach the hideout). Fail a mission and you can
  retry it; finish all three and the city is yours in free roam.
- **Combat** — mouse aim, click to shoot, with enemy health, muzzle particles
  and dropped cash.
- **HUD** — health, cash, wanted stars, a live minimap (player, cars, cops,
  mission marker), the current objective, a mission list and a speedometer
  while driving.
- **Menus and saving** — a start screen with the story and controls, pause,
  BUSTED / WASTED game-over screens with restart, and progress (cash, mission,
  position) saved to localStorage after each mission.
- **Sound** — synthesized WebAudio only: engine hum that follows your speed,
  a wailing siren while wanted, gunshots, crashes, pickups and a mission-pass
  jingle. **M** mutes.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser and play with keyboard
and mouse.

## Layout

- `game/index.html` — the page; everything else is plain static files.
- `game/src/config.js` — tuning numbers, colours and the city seed.
- `game/src/world.js` — the city: street grid, buildings, park, beach, collision.
- `game/src/entities.js` — the simulation: player, traffic, pedestrians, police, bullets.
- `game/src/missions.js` — the three story missions, markers and rewards.
- `game/src/render.js` — drawing: city, cars, people, HUD, minimap, menus.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — synthesized WebAudio sounds.
- `game/src/shots.js` — deterministic `?shot=chase|drive|foot|mission` scenes for screenshots.
- `game/src/main.js` — boot, the fixed-step loop, screens and saving.
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`.
- `screenshots/` — four real renders of the game, taken in headless Chromium.

## Screenshots

1. `1-chase.jpg` — a three-star police chase with the mission HUD and minimap.
2. `2-drive.jpg` — driving through downtown traffic.
3. `3-foot.jpg` — on foot in Sunset Park.
4. `4-mission.jpg` — the Package Run mission in progress.

## License

MIT — see [LICENSE](LICENSE).
