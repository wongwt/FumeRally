import { fmtTime } from '../core/format';
import { pad6 } from '../core/math';
import { POWER_TIME } from '../config/constants';
import { t } from '../i18n';
import type { CarId } from '../config/cars';
import type { ClearInfo } from '../game/progress';
import { carIcon } from './carIcons';
import type { Sim } from '../sim/sim';
import type { RunRow } from '../storage/records';

export type BannerKind = 'card' | 'toast';

/** Everything beyond the sim itself that the title, clear and game-over screens show. */
export interface ScreenContext {
  /** e.g. "Normal mode" or "Daily challenge XL38QJ". */
  challengeLabel: string;
  /** Start-stage picker; null when it does not apply (code boards, or nothing cleared yet). */
  picker: { level: number; max: number } | null;
  /** Car picker (left/right keys); null until a second car is unlocked. */
  carPicker: { id: CarId; name: string } | null;
  /** Top runs of the current board. */
  records: RunRow[];
  /** What the last stage clear did to the best time. */
  clear: ClearInfo;
}

const kbd = (...keys: string[]): string => keys.map((k) => `<kbd>${k}</kbd>`).join('');
const spaceKey = (): string => kbd(t('keys.space'));

/** The overlay card or toast in the middle of the stage. */
export class Banner {
  constructor(
    private readonly el: HTMLElement,
    private readonly context: () => ScreenContext
  ) {}

  show(html: string, kind: BannerKind = 'card'): void {
    this.el.className = 'banner ' + kind;
    this.el.innerHTML = `<div class="panel">${html}</div>`;
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }

  /** Draws whatever the simulation's current phase calls for. */
  render(sim: Sim): void {
    const ctx = this.context();
    switch (sim.phase) {
      case 'title':
        this.show(titleHtml(ctx), 'card');
        break;
      case 'ready':
        this.show(
          sim.bonus
            ? `<p class="eyebrow">BONUS STAGE</p><p class="big">${t('ready.bonusTitle')}</p><p class="lead">${t('ready.bonusLead')}</p>`
            : `<p class="eyebrow">STAGE ${sim.level}</p><p class="big">${t('ready.go')}</p>`,
          'toast'
        );
        break;
      case 'play':
        this.hide();
        break;
      case 'paused':
        this.show(
          `<p class="eyebrow">PAUSE</p><h2>${t('pause.title')}</h2><p class="cta">${t('cta.resume', { key: kbd('P') })}</p>`,
          'card'
        );
        break;
      case 'dying':
        this.show(`<p class="big">${t(`crash.${sim.crashWhy}`)}</p>`, 'toast');
        break;
      case 'clear':
        this.show(sim.clearKind === 'bonus' ? bonusClearHtml(sim) : levelClearHtml(sim, ctx), 'toast');
        break;
      case 'over':
        this.show(
          `<p class="eyebrow">GAME OVER</p><h2>${t('over.title')}</h2>` +
            `<p class="score-line">${t('over.score', { n: pad6(sim.score) })}</p>` +
            `<p class="lead">${t('over.summary', { mode: ctx.challengeLabel, n: sim.clearedInRun, t: fmtTime(sim.runTime) })}</p>` +
            (sim.newRecord ? `<p class="record">${t('over.record')}</p>` : '') +
            pickerHtml(ctx) +
            carPickerHtml(ctx) +
            recordsHtml(ctx) +
            `<p class="cta">${t('cta.restart', { key: spaceKey() })}</p>`,
          'card'
        );
        break;
    }
  }
}

function levelClearHtml(sim: Sim, ctx: ScreenContext): string {
  const { bestPrev, newBest } = ctx.clear;
  let note = '';
  if (newBest) note = `<p class="record">${t('clear.newBest')}</p>`;
  else if (bestPrev != null)
    note = `<p class="lead">${t(sim.lvDeaths ? 'clear.bestNoCount' : 'clear.best', { t: fmtTime(bestPrev, true) })}</p>`;
  else if (sim.lvDeaths) note = `<p class="lead">${t('clear.flawlessHint')}</p>`;
  if (ctx.clear.unlocked)
    note += `<p class="record">${t('clear.unlocked', { name: t(`car.${ctx.clear.unlocked}.name`) })}</p>`;
  return (
    `<p class="eyebrow">STAGE ${sim.level} CLEAR</p><p class="big">${t('clear.title')}</p>` +
    `<p class="score-line">${t('clear.fuelBonus', { n: sim.lastFuelBonus })}</p>` +
    `<p class="lead">${t('clear.time', { t: fmtTime(sim.lvT, true) })}</p>` +
    note
  );
}

function bonusClearHtml(sim: Sim): string {
  return (
    `<p class="eyebrow">BONUS STAGE</p><p class="big">${t(sim.bonusPerfect ? 'bonus.perfect' : 'bonus.timeUp')}</p>` +
    `<p class="score-line">${sim.bonusAward ? t('bonus.award', { n: sim.bonusAward }) : t('bonus.again')}</p>`
  );
}

/** "Start stage ↑↓ 3 (up to 5)", shown in normal mode once a stage has been cleared. */
function pickerHtml(ctx: ScreenContext): string {
  if (!ctx.picker) return '';
  return `<p class="picker">${t('picker.level', { keys: kbd('↑', '↓'), n: `<b>${ctx.picker.level}</b>`, max: ctx.picker.max })}</p>`;
}

/** "Car ←→ [icon] Sedan", shown once there is a choice of cars. */
function carPickerHtml(ctx: ScreenContext): string {
  if (!ctx.carPicker) return '';
  const { id, name } = ctx.carPicker;
  return `<p class="picker">${t('picker.car', { keys: kbd('←', '→'), icon: `<span class="mini">${carIcon(id)}</span>`, name: `<b>${name}</b>` })}</p>`;
}

/** Top three runs of the current board (hidden on wide screens, where the side panel shows them). */
function recordsHtml(ctx: ScreenContext): string {
  if (!ctx.records.length) return '';
  const rows = ctx.records
    .slice(0, 3)
    .map(
      (r, i) =>
        `<div class="row"><span>${i + 1}.</span><span>${t('records.row', { l: r.l, t: fmtTime(r.t) })}</span><b>${pad6(r.s)}</b></div>`
    )
    .join('');
  return `<div class="records"><p class="eyebrow">BEST</p>${rows}</div>`;
}

function titleHtml(ctx: ScreenContext): string {
  return (
    `<p class="eyebrow">${t('app.subtitle')}</p><h2>${t('app.title')}</h2>` +
    `<p class="lead">${t('title.lead')}</p>` +
    `<ul class="legend"><li>${kbd('↑', '↓', '←', '→')} ${t('keys.or')} ${kbd('W', 'A', 'S', 'D')} ${t('title.drive')}</li>` +
    `<li>${spaceKey()} ${t('title.smoke')}&emsp;${kbd('V')} ${t('keys.view')}</li>` +
    `<li>${t('title.power', { n: POWER_TIME })}</li></ul>` +
    `<p class="picker">${ctx.challengeLabel}</p>` +
    pickerHtml(ctx) +
    carPickerHtml(ctx) +
    recordsHtml(ctx) +
    `<p class="cta">${t('cta.start', { key: spaceKey() })}</p>`
  );
}
