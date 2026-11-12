import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../src/i18n/en';
import { getLang, initLang, onLangChange, resetLangForTests, setLang, t } from '../src/i18n';
import { zhTW } from '../src/i18n/zh-TW';

function stubStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v)
  });
  return store;
}

beforeEach(() => void stubStorage());
afterEach(() => {
  resetLangForTests();
  vi.unstubAllGlobals();
});

describe('i18n', () => {
  it('defaults to zh-TW', () => {
    expect(initLang()).toBe('zh-TW');
    expect(t('app.title')).toBe('廢氣拉力賽');
  });

  it('switches language and notifies listeners', () => {
    const spy = vi.fn();
    onLangChange(spy);
    setLang('en');
    expect(getLang()).toBe('en');
    expect(t('hud.score')).toBe('SCORE');
    expect(spy).toHaveBeenCalledWith('en');
  });

  it('remembers the chosen language', () => {
    const store = stubStorage();
    setLang('en');
    expect(store.get('fumeRallyLang')).toBe('en');
    resetLangForTests();
    expect(initLang()).toBe('en');
  });

  it('ignores an invalid saved value', () => {
    stubStorage();
    localStorage.setItem('fumeRallyLang', 'klingon');
    expect(initLang()).toBe('zh-TW');
  });

  it('fills placeholders and leaves unknown ones intact', () => {
    expect(t('hud.livesAria', { n: 3 })).toBe('剩餘 3 台車');
    setLang('en');
    expect(t('hud.livesAria', { n: 2 })).toBe('2 cars left');
    expect(t('hud.livesAria')).toBe('{n} cars left');
  });

  it('English provides exactly the same keys as zh-TW', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zhTW).sort());
    // the English UI has no subtitle: the title already says "Fume Rally"
    for (const [k, v] of Object.entries(en)) if (k !== 'app.subtitle') expect(v.trim()).not.toBe('');
  });
});
