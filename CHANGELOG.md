# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-12

The first stable release, after a round of changes based on player feedback. Level codes, maps and saved
data are meant to stay stable from here: changing how a level is generated would be a breaking change.

### Added

- An About button in the footer opens a dialog with the version, copyright and licence, a link to the
  source, and the third-party software (three.js, Press Start 2P) and tools (TypeScript, Vite, Vitest,
  ESLint, Prettier and others) the game is made with. Versions come from `package.json` at build time.

### Changed

- Mazes grow with the level: level 1 is 19 × 13 and the size steps up to 31 × 21 from level 13 (the old
  fixed size was 27 × 19, reached on level 7).
- Mazes get harder as levels rise: early ones are open and branchy with many shortcuts, later ones are
  twistier with fewer loops.
- Cars start a run at 85% of their rated speed and speed up 2% per level, reaching full speed on level 9.
- The follow camera is zoomed in (about 7 tiles tall instead of 11) so the radar is more useful.
- The right-hand panel is split by moment. While driving it shows only the radar, plus the car and mode.
  On the title and game-over screens it is a tabbed menu with Garage, Mode and Board tabs and an
  always-visible Start button. The level-code field only appears in the daily and level-code modes, and
  the achievements block is gone from the panel (the footer button remains).
- On phones the tabs float at the top of the stage and open a sheet over it, only on the title and
  game-over screens. The footer "Challenges" button is removed so nothing of the menu can be hit by
  accident next to the steering pad.
- The title card no longer repeats the key cheat sheet (the footer has it); the car-drives-itself and
  fuel notes moved into its intro text.
- The footer controls are ordered Mute, Pause, View, in both the key hints and the buttons.
- The Traditional Chinese language is now labelled 正體中文, and the English UI is just "Fume Rally",
  without the subtitle.
- Ghosts saved by earlier versions are not loaded (their mazes no longer exist); best times are kept.

### Fixed

- Driving into a red chaser that has not left home yet is now a crash, like any other chaser.

## [0.1.0] - 2026-11-12

First release: a from-scratch, modular rebuild of the original single-file prototype, with the same look
and feel.

### Game

- Grid-locked rally in a seeded, symmetric maze (27 × 19) with an auto-driving car, fuel that always drains,
  gems that refuel and build a ×1–×5 combo, deadly rocks, and 2–5 red chasers with three AI personalities.
- Exhaust smoke that stuns chasers; rainbow gems for 7 s of invincibility (smash rocks, knock chasers home);
  a timed 30 s bonus stage after every third level.
- Eight unlockable cars with their own models and abilities: sedan, sport, armored (absorbs a hit),
  off-roader (crushes rocks), tanker (frugal), scout (wider view), police (stunning siren), motorcycle.
- 32 achievements with unlock toasts.
- Daily challenge and shareable level codes (same code, same maps), per-board leaderboards, flawless best
  times, and a ghost car with live split deltas.
- Synthesised sound effects, a pixel-font HUD, a full-map radar, and a switchable camera.
- Traditional Chinese (default) and English.
- Works on desktop (keyboard) and phones/tablets (touch pad, swipes), in portrait and landscape.

### Project

- TypeScript + Vite + Vitest; the build is a single self-contained `dist/index.html` that needs no network.
- A pure, event-driven simulation covered by unit tests (including parity checks against the prototype's
  maps, gem and rock layouts, rainbow-gem order and daily codes).
- Versioned `localStorage` for records, ghosts and preferences; reads the prototype's save format.
- Accessibility: live regions, real dialogs with focus handling, translated control labels, reduced-motion
  support, and recovery from WebGL context loss.
- CI (typecheck, lint, format, tests, build) and a tag-triggered release workflow.
- MIT licensed; third-party notices (three.js, Press Start 2P) are embedded in the build.

[0.1.0]: https://github.com/wongwt/FumeRally/releases/tag/v0.1.0
