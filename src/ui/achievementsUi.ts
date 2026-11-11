import { ACHS, ACH_BY_ID, type AchDef, type AchId } from '../config/achievements';
import { t } from '../i18n';
import { achIcon } from './achIcons';

/** What the panel needs to know about progress. */
export interface AchProgress {
  has(id: AchId): boolean;
  readonly count: number;
  readonly total: number;
}

const cell = (a: AchDef, done: boolean): string =>
  `<div class="ach${done ? ' done' : ''}"><span class="aico">${achIcon(a, !done)}</span>` +
  `<b>${done ? t(`ach.${a.id}.name`) : t('ach.hidden')}</b><span>${done ? t(`ach.${a.id}.desc`) : t('ach.locked')}</span></div>`;

/** The achievements dialog: trophies for stages cleared, then the fun ones. Locked ones stay a mystery. */
export function achPanelHtml(p: AchProgress): string {
  const grid = (list: readonly AchDef[]): string =>
    `<div class="ach-grid">${list.map((a) => cell(a, p.has(a.id))).join('')}</div>`;
  const trophies = ACHS.filter((a) => a.lvl !== undefined);
  const fun = ACHS.filter((a) => a.lvl === undefined);
  return (
    `<div class="mcard wide"><p class="eyebrow">ACHIEVEMENTS</p><h2>${t('ach.title', { n: p.count, total: p.total })}</h2>` +
    `<p class="board-sub">${t('ach.trophies')}</p>${grid(trophies)}` +
    `<p class="board-sub">${t('ach.fun')}</p>${grid(fun)}` +
    `<button type="button" class="start-btn" data-close="1">${t('btn.close')}</button></div>`
  );
}

/** Toast contents for one unlocked achievement. */
export function achToastHtml(id: AchId): string {
  const a = ACH_BY_ID[id] as AchDef;
  return `<span class="aico">${achIcon(a)}</span><span><small>ACHIEVEMENT UNLOCKED</small><b>${t(`ach.${id}.name`)}</b></span>`;
}

export interface ToastScheduler {
  setTimeout(fn: () => void, ms: number): unknown;
}

/**
 * Shows unlock toasts one at a time: each stays for a few seconds, with a short gap, so several
 * unlocks in one moment queue up instead of overlapping.
 */
export class ToastQueue {
  static readonly SHOW_MS = 3200;
  static readonly GAP_MS = 250;
  private readonly queue: AchId[] = [];
  private busy = false;

  constructor(
    private readonly show: (id: AchId) => void,
    private readonly hide: () => void,
    private readonly scheduler: ToastScheduler = globalThis
  ) {}

  push(id: AchId): void {
    this.queue.push(id);
    this.next();
  }

  get pending(): number {
    return this.queue.length;
  }

  private next(): void {
    if (this.busy) return;
    const id = this.queue.shift();
    if (!id) return;
    this.busy = true;
    this.show(id);
    this.scheduler.setTimeout(() => {
      this.hide();
      this.busy = false;
      this.scheduler.setTimeout(() => this.next(), ToastQueue.GAP_MS);
    }, ToastQueue.SHOW_MS);
  }
}
