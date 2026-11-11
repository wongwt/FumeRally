import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] as string);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith('.ts') ? [p] : [];
  });

describe('index.html', () => {
  it('has no duplicate ids (a lookup would silently hit the wrong element)', () => {
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('contains every element id the code looks up', () => {
    const wanted = new Set<string>();
    for (const file of sourceFiles('src')) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\$(?:<[^>]*>)?\('([A-Za-z][\w-]*)'\)/g)) wanted.add(m[1] as string);
      for (const m of text.matchAll(/getElementById\('([^']+)'\)/g)) wanted.add(m[1] as string);
    }
    expect(wanted.size).toBeGreaterThan(20);
    const missing = [...wanted].filter((id) => !ids.includes(id));
    expect(missing).toEqual([]);
  });

  it('points every data-i18n attribute at an existing message', async () => {
    const { zhTW } = await import('../src/i18n/zh-TW');
    const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1] as string);
    expect(keys.length).toBeGreaterThan(15);
    expect(keys.filter((k) => !(k in zhTW))).toEqual([]);
  });

  it('points every data-i18n-label (aria-label) at an existing message', async () => {
    const { zhTW } = await import('../src/i18n/zh-TW');
    const keys = [...html.matchAll(/data-i18n-label="([^"]+)"/g)].map((m) => m[1] as string);
    expect(keys.length).toBeGreaterThanOrEqual(8);
    expect(keys.filter((k) => !(k in zhTW))).toEqual([]);
  });

  it('gives the live regions and dialog their roles', () => {
    expect(html).toMatch(/id="banner"[^>]*role="status"/);
    expect(html).toMatch(/id="achToast"[^>]*role="status"/);
    expect(html).toMatch(/id="modal"[^>]*role="dialog"[^>]*aria-modal="true"/);
    expect(html).toMatch(/id="fuelTrack"[^>]*role="progressbar"/);
  });

  it('keeps the touch controls inside the stage so they overlay it', () => {
    const stage = html.slice(html.indexOf('<main class="stage"'), html.indexOf('</main>'));
    expect(stage).toContain('class="touch"');
    expect(html.slice(html.indexOf('<footer'))).not.toContain('class="touch"');
  });
});
