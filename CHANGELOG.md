# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The Traditional Chinese language is now labelled 正體中文.
- The English UI is just "Fume Rally", without the subtitle.
- Mazes grow with the level: level 1 is 19 × 13 and the size steps up to 31 × 21 from level 13 (the old
  fixed size was 27 × 19, reached on level 7).
- Mazes get harder as levels rise: early ones are open and branchy with many shortcuts, later ones are
  twistier with fewer loops.
- The follow camera is zoomed in (about 7 tiles tall instead of 11) so the radar is more useful.
- Cars start a run at 85% of their rated speed and speed up 2% per level, reaching full speed on level 9.
- Ghosts saved by earlier versions are not loaded (their mazes no longer exist); best times are kept.

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
