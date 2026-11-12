/** Who made the game and what it was made with, as shown in the About dialog. */
export const COPYRIGHT_YEAR = 2026;
export const AUTHOR = 'Wei-Te Wong';
export const REPO_URL = 'https://github.com/wongwt/FumeRally';

export interface Credit {
  name: string;
  /** The npm package whose version is shown (looked up in package.json at build time). */
  pkg?: string;
  /** Shown instead of a package version, e.g. for a font. */
  note?: string;
  license: string;
  url: string;
}

/** Third-party code and assets that are inside the shipped game. Their notices are in THIRD_PARTY_NOTICES.md. */
export const SHIPPED: readonly Credit[] = [
  { name: 'three.js', pkg: 'three', license: 'MIT', url: 'https://threejs.org' },
  {
    name: 'Press Start 2P',
    note: 'pixel font',
    license: 'SIL OFL 1.1',
    url: 'https://fonts.google.com/specimen/Press+Start+2P'
  }
];

/** Tools used to build and test the game; none of them ships in it. */
export const TOOLS: readonly Credit[] = [
  { name: 'TypeScript', pkg: 'typescript', license: 'Apache-2.0', url: 'https://www.typescriptlang.org' },
  { name: 'Vite', pkg: 'vite', license: 'MIT', url: 'https://vite.dev' },
  {
    name: 'vite-plugin-singlefile',
    pkg: 'vite-plugin-singlefile',
    license: 'MIT',
    url: 'https://github.com/richardtallent/vite-plugin-singlefile'
  },
  { name: 'Vitest', pkg: 'vitest', license: 'MIT', url: 'https://vitest.dev' },
  { name: 'happy-dom', pkg: 'happy-dom', license: 'MIT', url: 'https://github.com/capricorn86/happy-dom' },
  { name: 'ESLint', pkg: 'eslint', license: 'MIT', url: 'https://eslint.org' },
  {
    name: 'typescript-eslint',
    pkg: 'typescript-eslint',
    license: 'MIT',
    url: 'https://typescript-eslint.io'
  },
  { name: 'Prettier', pkg: 'prettier', license: 'MIT', url: 'https://prettier.io' }
];

/** The version of a package, or '' when it is unknown (e.g. outside a Vite build). */
export const versionOf = (pkg: string): string =>
  (typeof __PKG_VERSIONS__ === 'undefined' ? undefined : __PKG_VERSIONS__[pkg]) ?? '';

export const appVersion = (): string => versionOf('__app__');
