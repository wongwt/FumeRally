// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChallengeMode } from '../src/core/challenge';
import { ChallengePanel, type PanelModel } from '../src/ui/challengePanel';

const model = (mode: ChallengeMode): PanelModel => ({
  mode,
  customCode: 'RALLY7',
  dailyCode: 'XL38QJ',
  valid: true,
  locked: false,
  ghostOn: true,
  label: 'label',
  rows: [],
  stageTimes: [],
  carName: 'Sedan'
});

describe('ChallengePanel code field', () => {
  let panel: ChallengePanel;
  const shown = (sel: string) => (document.querySelector(sel) as HTMLElement).hidden === false;

  beforeEach(() => {
    document.body.innerHTML = `<section id="challenge">
      <button class="seg-btn" data-mode="normal"></button><button class="seg-btn" data-mode="daily"></button>
      <button class="seg-btn" data-mode="custom"></button>
      <div class="codebox"><label></label><div class="coderow"><input id="codeInput" /><button id="btnRand"></button></div>
      <p id="codeHint"></p></div>
      <input type="checkbox" id="ghostToggle" /><button id="btnStartChal"></button>
      <div id="board"></div><p id="runInfo"></p></section>`;
    const noop = (): void => undefined;
    panel = new ChallengePanel({ onMode: noop, onCode: noop, onRandom: noop, onGhost: noop, onStart: noop });
  });

  it('is hidden in normal mode, but its explanation stays', () => {
    panel.update(model('normal'));
    expect(shown('.codebox label')).toBe(false);
    expect(shown('.coderow')).toBe(false);
    expect(shown('#codeHint')).toBe(true);
  });

  it('shows in daily mode (read-only) and level-code mode (editable)', () => {
    const input = document.getElementById('codeInput') as HTMLInputElement;
    panel.update(model('daily'));
    expect(shown('.coderow')).toBe(true);
    expect(input.value).toBe('XL38QJ');
    expect(input.disabled).toBe(true);
    panel.update(model('custom'));
    expect(shown('.coderow')).toBe(true);
    expect(input.value).toBe('RALLY7');
    expect(input.disabled).toBe(false);
  });
});
