import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string): string => readFileSync(p, 'utf8');
const normalise = (s: string): string => s.replace(/\s+/g, ' ').trim();

describe('third-party notices', () => {
  const notices = normalise(read('THIRD_PARTY_NOTICES.md'));

  it('contain the installed three.js licence verbatim (refresh the file when three.js is upgraded)', () => {
    expect(notices).toContain(normalise(read('node_modules/three/LICENSE')));
  });

  it("contain the bundled font's licence verbatim", () => {
    expect(notices).toContain(normalise(read('src/assets/fonts/OFL.txt')));
  });

  it('name the version of three.js that is actually installed', () => {
    const version = (JSON.parse(read('node_modules/three/package.json')) as { version: string }).version;
    expect(notices).toContain(`three.js ${version}`);
  });

  it('are listed next to the project licence', () => {
    expect(read('LICENSE')).toContain('MIT License');
    expect(read('LICENSE')).toContain('Wei-Te Wong');
  });
});
