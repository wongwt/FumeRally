# Fume Rally · 廢氣拉力賽

[![CI](https://github.com/wongwt/FumeRally/actions/workflows/ci.yml/badge.svg)](https://github.com/wongwt/FumeRally/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Three.js](https://img.shields.io/badge/three.js-r187-black)

A retro maze-rally arcade game for the browser, built with Three.js and TypeScript.
Collect every gem, outrun the red chasers, and leave a cloud of exhaust to stun them. Watch out for rocks and your fuel gauge.

> Inspired by the classic arcade game Rally-X. Not affiliated with or endorsed by Bandai Namco.
> All graphics and sounds are original and generated procedurally.

> **Status:** work in progress. The game is being rebuilt from a single-file prototype, one milestone at a time.

## Development

Requires Node.js 22+.

```sh
npm install
npm run dev        # local dev server with hot reload
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm run build      # produces dist/index.html, a single self-contained playable file
```

The build output is one HTML file with all code inlined. It runs by double-clicking it, with no server and no network needed.

## Project layout

```
src/
  config/   game constants (grid size, start, homes, directions)
  core/     pure, tested logic (math, RNG, maze generation, BFS pathfinding)
  sim/      pure game rules (grid movement, fixed-timestep stepper)
  input/    keyboard, swipe and d-pad → one wanted direction
  game/     glue between sim, render and input
  render/   Three.js scene, maze meshes and camera rig
  i18n/     message tables (zh-TW, en) and the t() lookup
tests/      Vitest unit tests
```

More folders (sim, render, audio, input, ui, storage) are added as the milestones land.

## License

[MIT](LICENSE)
