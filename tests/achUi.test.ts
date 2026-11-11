import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACHS, type AchId } from '../src/config/achievements';
import { getLang, resetLangForTests, setLang } from '../src/i18n';
import { en } from '../src/i18n/en';
import { zhTW } from '../src/i18n/zh-TW';
import { ACH_ICON_NAMES, achIcon } from '../src/ui/achIcons';
import { achPanelHtml, achToastHtml, ToastQueue } from '../src/ui/achievementsUi';

describe('achievement texts', () => {
  it('every achievement has a name and description in both languages', () => {
    for (const a of ACHS) {
      for (const table of [zhTW, en] as Record<string, string>[]) {
        expect(table[`ach.${a.id}.name`]?.trim(), `${a.id} name`).toBeTruthy();
        expect(table[`ach.${a.id}.desc`]?.trim(), `${a.id} desc`).toBeTruthy();
      }
    }
  });

  it('every achievement uses a drawable icon', () => {
    for (const a of ACHS) expect(ACH_ICON_NAMES).toContain(a.icon);
    expect(achIcon({ icon: 'trophy', tier: 'gold' })).toContain('#ffc83d');
    expect(achIcon({ icon: 'trophy', tier: 'gold' }, true)).toContain('?');
  });
});

describe('achPanelHtml', () => {
  afterEach(() => resetLangForTests());
  const progress = (done: AchId[]) => ({
    has: (id: AchId) => done.includes(id),
    count: done.length,
    total: ACHS.length
  });

  it('shows a title with the count and a cell for every achievement', () => {
    const html = achPanelHtml(progress(['t3', 'first_puff']));
    expect(html).toContain('成就 2 / 32');
    expect(html.match(/class="ach(?: done)?"/g)).toHaveLength(32);
    expect(html.match(/class="ach done"/g)).toHaveLength(2);
  });

  it('reveals names and descriptions only for unlocked achievements', () => {
    const html = achPanelHtml(progress(['t3']));
    expect(html).toContain('見習車手');
    expect(html).toContain('突破第 3 關');
    expect(html).not.toContain('街頭新秀');
    expect(html).toContain('？？？');
  });

  it('follows the language', () => {
    setLang('en');
    expect(getLang()).toBe('en');
    const html = achPanelHtml(progress(['t3']));
    expect(html).toContain('Rookie Driver');
    expect(html).toContain('Achievements 1 / 32');
  });

  it('groups trophies and fun achievements', () => {
    const html = achPanelHtml(progress([]));
    expect(html.indexOf('獎盃')).toBeLessThan(html.indexOf('趣味成就'));
    expect(html.match(/class="ach-grid"/g)).toHaveLength(2);
  });

  it('the toast names the achievement', () => {
    expect(achToastHtml('combo5')).toContain('五連吃');
    expect(achToastHtml('combo5')).toContain('ACHIEVEMENT UNLOCKED');
  });
});

describe('ToastQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const shown: AchId[] = [];
    const hide = vi.fn();
    const q = new ToastQueue((id) => shown.push(id), hide, { setTimeout: (fn, ms) => setTimeout(fn, ms) });
    return { q, shown, hide };
  };

  it('shows one toast at a time, each for a few seconds', () => {
    const { q, shown, hide } = make();
    q.push('t3');
    q.push('t5');
    expect(shown).toEqual(['t3']);
    expect(q.pending).toBe(1);
    vi.advanceTimersByTime(ToastQueue.SHOW_MS - 1);
    expect(hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(hide).toHaveBeenCalledTimes(1);
    expect(shown).toEqual(['t3']); // a short gap before the next one
    vi.advanceTimersByTime(ToastQueue.GAP_MS);
    expect(shown).toEqual(['t3', 't5']);
    vi.advanceTimersByTime(ToastQueue.SHOW_MS);
    expect(hide).toHaveBeenCalledTimes(2);
    expect(q.pending).toBe(0);
  });

  it('shows a late arrival right away when idle', () => {
    const { q, shown } = make();
    q.push('t3');
    vi.advanceTimersByTime(ToastQueue.SHOW_MS + ToastQueue.GAP_MS + 10);
    q.push('t5');
    expect(shown).toEqual(['t3', 't5']);
  });

  it('keeps order when many unlock at once', () => {
    const { q, shown } = make();
    for (const id of ['t3', 't5', 't10'] as const) q.push(id);
    vi.advanceTimersByTime((ToastQueue.SHOW_MS + ToastQueue.GAP_MS) * 3);
    expect(shown).toEqual(['t3', 't5', 't10']);
  });
});
