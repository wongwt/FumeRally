import { CAR_ORDER, CARS, carUnlocked, nextLockedCar, type CarId } from '../config/cars';
import { t } from '../i18n';
import { carIcon } from './carIcons';

export interface GarageModel {
  selected: CarId;
  /** Highest stage cleared in any mode. */
  carLv: number;
  /** A game is running, so the car cannot be changed. */
  locked: boolean;
}

/** The garage grid in the side panel: pick an unlocked car, see its stats. */
export class Garage {
  private readonly buttons = new Map<CarId, HTMLButtonElement>();
  private readonly hint = document.getElementById('carHint') as HTMLElement;

  constructor(
    private readonly host: HTMLElement,
    onSelect: (id: CarId) => void
  ) {
    for (const id of CAR_ORDER) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'car-btn';
      b.dataset.car = id;
      b.innerHTML = '<i class="cico"></i><span></span>';
      b.addEventListener('click', () => {
        onSelect(id);
        b.blur();
      });
      this.host.appendChild(b);
      this.buttons.set(id, b);
    }
  }

  update(m: GarageModel): void {
    for (const [id, b] of this.buttons) {
      const open = carUnlocked(id, m.carLv);
      b.setAttribute('aria-pressed', String(id === m.selected));
      b.disabled = m.locked || !open;
      (b.querySelector('.cico') as HTMLElement).innerHTML = carIcon(id, !open);
      b.setAttribute('aria-label', open ? t(`car.${id}.name`) : t('car.locked', { n: CARS[id].unlock }));
      (b.querySelector('span') as HTMLElement).textContent = open
        ? t(`car.${id}.name`)
        : t('car.lockedLabel', { n: CARS[id].unlock });
    }
    const d = CARS[m.selected];
    const stats = d.armor
      ? t('car.statsArmor', { speed: d.speed.toFixed(1), drain: d.drain.toFixed(1), n: d.armor })
      : t('car.stats', { speed: d.speed.toFixed(1), drain: d.drain.toFixed(1) });
    let text = t('car.hint', { name: t(`car.${m.selected}.name`), note: t(`car.${m.selected}.note`), stats });
    const next = nextLockedCar(m.carLv);
    if (next) text += ' ' + t('car.nextUnlock', { n: CARS[next].unlock });
    this.hint.textContent = text;
  }
}
