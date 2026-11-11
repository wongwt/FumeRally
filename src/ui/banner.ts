import { fmtTime } from '../core/format';
import { pad6 } from '../core/math';
import { POWER_TIME } from '../config/constants';
import { t } from '../i18n';
import type { Sim } from '../sim/sim';

export type BannerKind = 'card' | 'toast';

const kbd = (...keys: string[]): string => keys.map((k) => `<kbd>${k}</kbd>`).join('');
const spaceKey = (): string => kbd(t('keys.space'));

/** The overlay card or toast in the middle of the stage. */
export class Banner {
  constructor(private readonly el: HTMLElement) {}

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
    switch (sim.phase) {
      case 'title':
        this.show(titleHtml(), 'card');
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
        this.show(sim.clearKind === 'bonus' ? bonusClearHtml(sim) : levelClearHtml(sim), 'toast');
        break;
      case 'over':
        this.show(
          `<p class="eyebrow">GAME OVER</p><h2>${t('over.title')}</h2>` +
            `<p class="score-line">${t('over.score', { n: pad6(sim.score) })}</p>` +
            `<p class="lead">${t('over.summary', { n: sim.clearedInRun, t: fmtTime(sim.runTime) })}</p>` +
            (sim.newRecord ? `<p class="record">${t('over.record')}</p>` : '') +
            `<p class="cta">${t('cta.restart', { key: spaceKey() })}</p>`,
          'card'
        );
        break;
    }
  }
}

function levelClearHtml(sim: Sim): string {
  return (
    `<p class="eyebrow">STAGE ${sim.level} CLEAR</p><p class="big">${t('clear.title')}</p>` +
    `<p class="score-line">${t('clear.fuelBonus', { n: sim.lastFuelBonus })}</p>` +
    `<p class="lead">${t('clear.time', { t: fmtTime(sim.lvT, true) })}</p>`
  );
}

function bonusClearHtml(sim: Sim): string {
  return (
    `<p class="eyebrow">BONUS STAGE</p><p class="big">${t(sim.bonusPerfect ? 'bonus.perfect' : 'bonus.timeUp')}</p>` +
    `<p class="score-line">${sim.bonusAward ? t('bonus.award', { n: sim.bonusAward }) : t('bonus.again')}</p>`
  );
}

function titleHtml(): string {
  return (
    `<p class="eyebrow">${t('app.subtitle')}</p><h2>${t('app.title')}</h2>` +
    `<p class="lead">${t('title.lead')}</p>` +
    `<ul class="legend"><li>${kbd('↑', '↓', '←', '→')} ${t('keys.or')} ${kbd('W', 'A', 'S', 'D')} ${t('title.drive')}</li>` +
    `<li>${spaceKey()} ${t('title.smoke')}&emsp;${kbd('V')} ${t('keys.view')}</li>` +
    `<li>${t('title.power', { n: POWER_TIME })}</li></ul>` +
    `<p class="cta">${t('cta.start', { key: spaceKey() })}</p>`
  );
}
