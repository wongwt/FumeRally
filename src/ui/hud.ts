import { FUEL_MAX } from '../config/constants';
import { fmtTime } from '../core/format';
import { pad6 } from '../core/math';
import { t } from '../i18n';
import type { Sim } from '../sim/sim';

const carIcon =
  '<svg viewBox="0 0 24 14" width="22" height="13" aria-hidden="true"><rect x="1" y="3" width="22" height="9" rx="2" fill="currentColor"/><rect x="8" y="1" width="8" height="12" rx="1.5" fill="#08141d" opacity="0.55"/></svg>';

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

/** Top HUD: score, level, lives, fuel and so on. Only touches the DOM when a value changes. */
export class Hud {
  private readonly el = {
    score: $('score'),
    hi: $('hi'),
    level: $('level'),
    combo: $('combo'),
    lives: $('lives'),
    gems: $('gemsLeft'),
    power: $('power'),
    time: $('timeEl'),
    delta: $('ghostDelta'),
    fuelFill: $('fuelFill'),
    fuelTrack: $('fuelTrack')
  };
  private readonly shown = new Map<string, string>();

  update(sim: Sim): void {
    this.set('score', this.el.score, pad6(sim.score));
    this.set('hi', this.el.hi, pad6(Math.max(sim.hi, sim.score)));
    this.set('level', this.el.level, sim.bonus ? 'BONUS' : String(sim.level));
    this.set('combo', this.el.combo, '×' + sim.mult);
    this.set('gems', this.el.gems, String(sim.gemsLeft));
    this.set('power', this.el.power, sim.power > 0 ? sim.power.toFixed(1) + 's' : '—');
    this.set('time', this.el.time, sim.bonus ? '-' + sim.bonusT.toFixed(1) : fmtTime(sim.lvT, true));
    const d = sim.ghostDelta;
    const deltaText = d == null ? '' : (d <= 0 ? '' : '+') + d.toFixed(1);
    this.set('delta', this.el.delta, deltaText, () => {
      this.el.delta.textContent = deltaText;
      this.el.delta.className = 'delta ' + (d != null && d <= 0 ? 'ahead' : 'behind');
    });
    if (this.shown.get('lives') !== String(sim.lives)) {
      this.shown.set('lives', String(sim.lives));
      this.el.lives.innerHTML = carIcon.repeat(Math.max(0, sim.lives));
      this.el.lives.setAttribute('aria-label', t('hud.livesAria', { n: sim.lives }));
    }
    const pct = Math.max(0, Math.min(1, sim.fuel / FUEL_MAX));
    this.set('fuel', this.el.fuelFill, pct.toFixed(3), () => {
      this.el.fuelFill.style.transform = `scaleX(${pct.toFixed(3)})`;
    });
    const cls = sim.fuel < 25 ? 'bad' : sim.fuel < 50 ? 'warn' : '';
    this.set('fuelClass', this.el.fuelTrack, cls, () => {
      this.el.fuelTrack.className = 'fuel-track' + (cls ? ' ' + cls : '');
    });
  }

  /** Forget cached values so the next update rewrites everything (e.g. after a language change). */
  invalidate(): void {
    this.shown.clear();
  }

  private set(key: string, el: HTMLElement, value: string, apply?: () => void): void {
    if (this.shown.get(key) === value) return;
    this.shown.set(key, value);
    if (apply) apply();
    else el.textContent = value;
  }
}
