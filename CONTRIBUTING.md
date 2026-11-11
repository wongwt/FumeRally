# Contributing

Thanks for helping with Fume Rally! Bug reports, ideas, translations and pull requests are all welcome.

## Getting started

Requires **Node.js 22+**.

```sh
git clone https://github.com/wongwt/FumeRally.git
cd FumeRally
npm install
npm run dev        # local dev server with hot reload (shows a DEV bar: jump to a stage, unlock cars)
```

Before opening a pull request, run everything CI runs:

```sh
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

`npm run format` fixes formatting. `npm run build` produces `dist/index.html`, the single playable file.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first; it explains the one rule that keeps this codebase
testable (the simulation never touches the DOM, Three.js or audio) and has recipes for adding cars,
achievements and languages.

## Making changes

- **Test what you change.** Game rules live in `src/sim` and are tested without a browser; add or adjust a
  test next to the change. For anything visual, also play it: the numbers can be right while what the
  player sees is wrong (a past bug left the car invisible after a respawn although every state value was
  correct).
- **Keep behaviour compatible with saved data.** Maps, level codes, best times and ghosts depend on seeded
  formulas that must not change. See "Determinism and PoC parity" in the architecture notes.
- **Strings go in both languages.** Add keys to `src/i18n/zh-TW.ts` and `src/i18n/en.ts`.
- **No new runtime dependencies without discussion.** The game ships as one file with no network use.
- **Match the surrounding style.** Prettier and ESLint enforce most of it.

## Commit messages

Start the subject with a changelog tag, then a short imperative summary:

| Tag         | Use for                              |
| ----------- | ------------------------------------ |
| `[new]`     | a new capability                     |
| `[fix]`     | a bug fix                            |
| `[enhance]` | an improvement to existing behaviour |
| `[doc]`     | documentation only                   |

Example: `[fix] Show the car again after respawning from a crash`. Use the body to explain _why_.

## Pull requests

Keep them focused. The pull request template has a short checklist. By contributing you agree that your work
is licensed under the project's [MIT licence](LICENSE).

## Releases (maintainers)

1. Update `CHANGELOG.md` and bump the version: `npm version <x.y.z> --no-git-tag-version`.
2. Commit, then tag: `git tag v<x.y.z> && git push --tags`.
3. The **Release** workflow checks the tag matches `package.json`, runs the full checks, builds, and attaches
   `fume-rally-v<x.y.z>.html`, `THIRD_PARTY_NOTICES.md` and `LICENSE` to a new GitHub Release.

If you upgrade three.js, regenerate the three.js section of `THIRD_PARTY_NOTICES.md` (a test fails until you do).
