// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHIPPED, TOOLS, appVersion, versionOf } from '../src/config/about';
import { setLang } from '../src/i18n';
import { aboutHtml } from '../src/ui/aboutModal';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('About dialog', () => {
  it('shows the version from package.json and the copyright holder', () => {
    expect(appVersion()).toBe(pkg.version);
    setLang('en');
    const html = aboutHtml();
    expect(html).toContain(`Version ${pkg.version}`);
    expect(html).toContain('© 2026 Wei-Te Wong');
    expect(html).toContain('MIT License');
  });

  it('is available in both languages', () => {
    setLang('zh-TW');
    expect(aboutHtml()).toContain('版本');
    setLang('en');
    expect(aboutHtml()).toContain('Third-party software');
  });

  it('lists every credit, with the installed version of each package', () => {
    setLang('en');
    const html = aboutHtml();
    for (const c of [...SHIPPED, ...TOOLS]) {
      expect(html).toContain(c.name);
      if (c.pkg) {
        const range = pkg.dependencies[c.pkg] ?? pkg.devDependencies[c.pkg];
        expect(range, `${c.pkg} must be in package.json`).toBeDefined();
        expect(versionOf(c.pkg)).toBe((range as string).replace(/^[^\d]*/, ''));
        expect(html).toContain(`v${versionOf(c.pkg)}`);
      }
    }
  });

  it('opens external links safely', () => {
    const links = [...aboutHtml().matchAll(/<a [^>]*>/g)].map((m) => m[0]);
    expect(links.length).toBeGreaterThan(5);
    for (const l of links) {
      expect(l).toContain('target="_blank"');
      expect(l).toContain('rel="noopener noreferrer"');
    }
  });
});
