import { isCarId } from '../config/cars';
import { CHALLENGE_MODES, type ChallengeMode } from '../core/challenge';
import { fmtTime } from '../core/format';
import { pad6 } from '../core/math';
import { t } from '../i18n';
import type { RunRow } from '../storage/records';
import { carIcon } from './carIcons';

/** Everything the panel shows; the game builds it and hands it over. */
export interface PanelModel {
  mode: ChallengeMode;
  /** The custom code as typed. */
  customCode: string;
  dailyCode: string;
  /** A game can start with the current settings. */
  valid: boolean;
  /** A game is running, so the settings are frozen. */
  locked: boolean;
  ghostOn: boolean;
  label: string;
  rows: RunRow[];
  stageTimes: { level: number; seconds: number }[];
  /** Name of the selected car, for the best-times heading. */
  carName: string;
}

export interface PanelHandlers {
  onMode(mode: ChallengeMode): void;
  onCode(raw: string): void;
  onRandom(): void;
  onGhost(on: boolean): void;
  onStart(): void;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const fmtDate = (ms: number): string => {
  const d = new Date(ms);
  return d.getMonth() + 1 + '/' + d.getDate();
};

/** The side panel: challenge mode, level code, ghost toggle and the leaderboard. */
export class ChallengePanel {
  private readonly root = $('challenge');
  private readonly segs = [...this.root.querySelectorAll<HTMLButtonElement>('.seg-btn')];
  private readonly input = $<HTMLInputElement>('codeInput');
  private readonly rand = $<HTMLButtonElement>('btnRand');
  private readonly hint = $('codeHint');
  private readonly ghost = $<HTMLInputElement>('ghostToggle');
  private readonly start = $<HTMLButtonElement>('btnStartChal');
  private readonly board = $('board');

  constructor(handlers: PanelHandlers) {
    for (const b of this.segs) {
      b.addEventListener('click', () => {
        if (b.disabled) return;
        handlers.onMode(b.dataset.mode as ChallengeMode);
        b.blur();
      });
    }
    this.input.addEventListener('input', () => handlers.onCode(this.input.value));
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlers.onStart();
      }
    });
    this.rand.addEventListener('click', () => {
      handlers.onRandom();
      this.rand.blur();
    });
    this.ghost.addEventListener('change', () => handlers.onGhost(this.ghost.checked));
    this.start.addEventListener('click', () => {
      handlers.onStart();
      this.start.blur();
    });
  }

  update(m: PanelModel): void {
    this.root.classList.toggle('locked', m.locked);
    for (const b of this.segs) {
      const mode = b.dataset.mode as ChallengeMode;
      b.textContent = t(`mode.${mode}`);
      b.setAttribute('aria-pressed', String(mode === m.mode));
      b.disabled = m.locked;
    }
    // The field mirrors the mode: today's code (read-only), the typed code, or empty.
    const shown = m.mode === 'daily' ? m.dailyCode : m.mode === 'normal' ? '' : m.customCode;
    if (this.input.value !== shown) this.input.value = shown;
    this.input.disabled = m.locked || m.mode !== 'custom';
    this.input.placeholder = t(m.mode === 'normal' ? 'code.placeholderNormal' : 'code.placeholder');
    this.rand.disabled = m.locked;
    this.rand.textContent = t('code.random');
    this.hint.textContent = t(
      m.mode === 'normal'
        ? 'code.hint.normal'
        : m.mode === 'daily'
          ? 'code.hint.daily'
          : m.valid
            ? 'code.hint.custom'
            : 'code.hint.invalid'
    );
    this.ghost.checked = m.ghostOn;
    this.start.disabled = m.locked || !m.valid;
    this.start.textContent = t('btn.startGame');
    this.board.innerHTML = boardHtml(m);
  }

  focusCode(): void {
    this.input.focus();
  }
}

function boardHtml(m: PanelModel): string {
  let h = `<p class="board-title">${m.label}</p>`;
  h += `<div class="brow head"><span>#</span><span>${t('board.score')}</span><span>${t('board.level')}</span><span>${t('board.time')}</span><span>${t('board.car')}</span></div>`;
  m.rows.forEach((r, i) => {
    h += `<div class="brow" title="${fmtDate(r.d || 0)}"><span>${i + 1}</span><b>${pad6(r.s)}</b><span>${r.l}</span><span>${fmtTime(r.t)}</span><span class="mini">${carIcon(isCarId(r.c) ? r.c : 'sedan')}</span></div>`;
  });
  if (!m.rows.length) h += `<p class="hint">${t('board.none')}</p>`;
  if (m.stageTimes.length) {
    h += `<p class="board-sub">${t('board.bestTimesCar', { car: m.carName })}</p><div class="times">`;
    h += m.stageTimes
      .slice(0, 8)
      .map((s) => `<span>${t('board.stage', { n: s.level })} <b>${fmtTime(s.seconds, true)}</b></span>`)
      .join('');
    h += '</div>';
  }
  return h;
}

export { CHALLENGE_MODES };
