import { CARS, type CarId } from '../config/cars';
import { t } from '../i18n';
import { carIcon } from './carIcons';

const statBar = (label: string, pct: number, text: string): string =>
  `<div class="stbar"><span>${label}</span><i><u style="width:${Math.max(4, Math.min(100, Math.round(pct)))}%"></u></i><em>${text}</em></div>`;

/** The "new vehicle unlocked" dialog. */
export function unlockModalHtml(id: CarId): string {
  const d = CARS[id];
  return (
    `<div class="mcard"><p class="eyebrow">NEW VEHICLE UNLOCKED</p><div class="mcar">${carIcon(id)}</div>` +
    `<h2>${t(`car.${id}.name`)}</h2><p class="lead">${t(`car.${id}.intro`)}</p>` +
    `<div class="stbars">${statBar(t('unlock.speed'), (d.speed / 7.2) * 100, d.speed.toFixed(1))}` +
    `${statBar(t('unlock.economy'), (0.6 / d.drain) * 100, '×' + (1 / d.drain).toFixed(1))}</div>` +
    `<p class="record">${t(`car.${id}.note`)}</p>` +
    `<button type="button" class="start-btn" data-close="1">${t('unlock.take')}</button><p class="hint">${t('unlock.hint')}</p></div>`
  );
}
