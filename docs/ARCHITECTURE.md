# Architecture

Fume Rally is a TypeScript + Three.js game that builds into **one self-contained HTML file**.
This page explains how the code is organised and the rules that keep it testable.

## The one rule: the simulation knows nothing about the screen

```
config ──┐
core ────┼──► sim ──► game ──► main.ts
         │     ▲        ▲
         │     │ events │ reads state
         │   render · ui · audio · storage
```

- **`src/core/`** – pure helpers: seeded RNG, maze generation, BFS pathfinding, a typed event emitter,
  challenge codes, formatting.
- **`src/sim/`** – the game rules. `Sim` holds all state (fuel, gems, lives, chasers, phase) and advances
  it by `update(dt, wantedDirection, smoke)`. It imports only `config` and `core`: no DOM, no Three.js,
  no audio, no storage. It announces what happens through a typed event bus (`gemTaken`, `crash`,
  `levelClear`, `armorBroke`, …).
- **`src/render/`, `src/ui/`, `src/audio/`** – presenters. They read `Sim` state each frame and/or subscribe
  to its events to draw meshes, update the HUD, pop up text or play sounds.
- **`src/storage/`** – versioned `localStorage` (records, ghosts, preferences) behind an injectable
  `StorageLike`, so it is tested without a browser.
- **`src/game/`** – glue. `Game` owns the loop and wires everything together; `Progress` turns sim events
  into saved progress; `Achievements` awards achievements from events; `ChallengeState` tracks the
  selected mode and level code.
- **`src/main.ts`** – boot: storage, DOM lookups, buttons, language, audio unlock.

Because the sim is pure, nearly every rule has a fast unit test that runs it step by step with no browser.

## Phases

`title → ready → play → (dying → ready | clear → ready | over) → title…`, plus `paused`. A bonus stage
(every third level) is an ordinary stage with `bonus = true`. The sim emits a `phase` event on every change,
and the UI redraws its banner from that.

## Time

The simulation runs on a **fixed 120 Hz timestep** (`sim/stepper.ts`), so gameplay does not depend on the
display's refresh rate. Rendering runs once per animation frame and uses the latest state.

## Determinism

Maps, gem and rock layouts, rainbow-gem order and daily codes are pure functions of a seed and the level.
Mazes grow and get twistier with the level (`mazeSpec` in `core/maze.ts`: size steps, loop chance and
winding), so a level's size is part of its identity. Since v0.2 these formulas no longer match the original
prototype; daily and level-code _hashing_ still does (`tests/fixtures/poc-challenge.json`). Changing the
generator again invalidates players' ghosts, so bump the ghost storage key when you do. Chaser decisions use `Math.random` (as in the prototype); tests inject a
seeded generator through `sim.rand`.

## Rendering notes

- The look was designed against three.js r128's legacy colour and light handling. `render/threeConfig.ts`
  reproduces it (`ColorManagement` off, light intensities × π). Every render module imports the palette,
  which imports that file, so it always runs before any material is created.
- The maze is three `InstancedMesh`es. Gems, rocks, smoke, chasers and the ghost are small views that sync
  from sim state.
- The follow camera and the full-map camera are one `CameraRig`; the radar is a 2D canvas.

## Saved data

| Key                                               | Contents                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `fumeRallyRec`                                    | version `v`, best score, stages cleared, car-unlock progress, leaderboards, best times, achievements, counters |
| `fumeRallyGhosts2`                                | best run per stage (newest 30 kept)                                                                            |
| `fumeRallyChallenge`                              | mode, last custom code, ghost toggle, selected car                                                             |
| `fumeRallyView`, `fumeRallyMute`, `fumeRallyLang` | camera view, sound, language                                                                                   |

Everything is local to the browser. The game makes no network requests and collects nothing.
To change the shape of `fumeRallyRec`, bump `RECORDS_VERSION` and add a step to `migrate()` in
`src/storage/records.ts`; the loader already tolerates corrupt or foreign data.

## Languages

`src/i18n/zh-TW.ts` is the source of truth; `en.ts` is typed to have exactly the same keys, so a missing
translation is a compile error. `tests/markup.test.ts` checks that every `data-i18n` and `data-i18n-label`
in `index.html` exists. Car and achievement text use `car.<id>.*` and `ach.<id>.*` keys.

## Build

`npm run build` type-checks, then Vite bundles everything and `vite-plugin-singlefile` inlines it into
`dist/index.html` (including the pixel font). A small plugin (`embedNotices` in `vite.config.ts`) adds the
project licence and `THIRD_PARTY_NOTICES.md` as a comment at the top, because the bundled libraries'
licences require their notices to travel with copies. CI and the release workflow verify that.

## Recipes

**Add a car** – add a definition to `src/config/cars.ts` (and to `CAR_ORDER`), a body style in
`render/carModel.ts`, an icon in `ui/carIcons.ts`, `car.<id>.name/note/intro` in both language files, and any
ability in `sim/sim.ts` with a test.

**Add an achievement** – add it to `src/config/achievements.ts`, its `ach.<id>.name/desc` in both languages,
and the rule in `game/achievements.ts` with a test in `tests/achievements.test.ts`. Icons are drawn in
`ui/achIcons.ts`.

**Add a language** – add the table next to `en.ts` (typed `Messages`), register it in `src/i18n/index.ts`
(`Lang`, `LANGS`, `TABLES`). The language button cycles through `LANGS`.

**Debug panel** – `npm run dev` shows a DEV bar (jump to a stage, unlock cars) and exposes `window.__game`.
Neither is included in production builds.
