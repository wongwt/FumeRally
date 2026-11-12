// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { SideTabs } from '../src/ui/sideTabs';

const html = (id: string) => `<button id="tab-${id}" role="tab"></button>`;
const pane = (id: string) => `<div id="pane-${id}"></div>`;

describe('SideTabs', () => {
  let play: HTMLElement;
  let tabs: SideTabs;
  const btn = (id: string) => document.getElementById(`tab-${id}`) as HTMLButtonElement;
  const pn = (id: string) => document.getElementById(`pane-${id}`) as HTMLElement;
  const key = (el: HTMLElement, k: string) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

  beforeEach(() => {
    document.body.innerHTML =
      '<div id="play"><section id="root">' +
      ['car', 'challenge', 'board'].map(html).join('') +
      ['car', 'challenge', 'board'].map(pane).join('') +
      '</section></div>';
    play = document.getElementById('play') as HTMLElement;
    tabs = new SideTabs(play, document.getElementById('root') as HTMLElement);
  });

  it('starts on the garage tab with only its pane visible', () => {
    expect(btn('car').getAttribute('aria-selected')).toBe('true');
    expect(pn('car').hidden).toBe(false);
    expect(pn('challenge').hidden).toBe(true);
    expect(pn('board').hidden).toBe(true);
  });

  it('clicking a tab shows its pane and opens the phone sheet', () => {
    btn('board').click();
    expect(pn('board').hidden).toBe(false);
    expect(pn('car').hidden).toBe(true);
    expect(btn('board').getAttribute('aria-selected')).toBe('true');
    expect(btn('car').getAttribute('aria-selected')).toBe('false');
    expect(tabs.sheetOpen).toBe(true);
  });

  it('clicking the open tab again closes the sheet but keeps the tab selected', () => {
    btn('challenge').click();
    btn('challenge').click();
    expect(tabs.sheetOpen).toBe(false);
    expect(pn('challenge').hidden).toBe(false);
    btn('board').click();
    expect(tabs.sheetOpen).toBe(true);
  });

  it('open() and closeSheet() are what the game uses for invalid starts and game start', () => {
    tabs.open('challenge');
    expect(tabs.sheetOpen).toBe(true);
    expect(pn('challenge').hidden).toBe(false);
    tabs.closeSheet();
    expect(play.classList.contains('sheet')).toBe(false);
  });

  it('arrow keys move between tabs and wrap around', () => {
    key(btn('car'), 'ArrowRight');
    expect(btn('challenge').getAttribute('aria-selected')).toBe('true');
    key(btn('challenge'), 'ArrowLeft');
    key(btn('car'), 'ArrowLeft');
    expect(btn('board').getAttribute('aria-selected')).toBe('true');
    expect(btn('board').tabIndex).toBe(0);
    expect(btn('car').tabIndex).toBe(-1);
  });
});
