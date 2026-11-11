import type { DirName } from '../config/constants';
import type { PlayerInput } from './playerInput';

const SWIPE_DISTANCE = 24;

/** Swipe on the stage, the on-screen d-pad (`data-dir`) and the exhaust button (`data-smoke`). */
export function bindTouch(
  input: PlayerInput,
  stage: HTMLElement,
  /** Called for a tap or click on the stage (start, resume). */
  onTap: () => void,
  /** Title / game-over screens: swiping up/down steps the start stage, left/right the car. */
  menu: { active(): boolean; step(delta: 1 | -1): void; cycle(delta: 1 | -1): void },
  root: ParentNode = document
): void {
  let swipe: { x: number; y: number } | null = null;
  let menuSwipe: { x: number; y: number } | null = null;
  let pressed = false;
  stage.addEventListener('pointerdown', (e) => {
    stage.focus({ preventScroll: true });
    pressed = true;
    menuSwipe = menu.active() ? { x: e.clientX, y: e.clientY } : null;
    if (e.pointerType === 'touch') swipe = { x: e.clientX, y: e.clientY };
  });
  stage.addEventListener('pointermove', (e) => {
    if (menuSwipe) {
      const mx = e.clientX - menuSwipe.x;
      const my = e.clientY - menuSwipe.y;
      if (Math.abs(my) > 28 && Math.abs(my) > Math.abs(mx)) {
        menu.step(my < 0 ? 1 : -1);
        menuSwipe = { x: e.clientX, y: e.clientY };
        pressed = false;
      } else if (Math.abs(mx) > 28 && Math.abs(mx) > Math.abs(my)) {
        menu.cycle(mx > 0 ? 1 : -1);
        menuSwipe = { x: e.clientX, y: e.clientY };
        pressed = false;
      }
      return;
    }
    if (!swipe) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (Math.hypot(dx, dy) < SWIPE_DISTANCE) return;
    input.swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    swipe = { x: e.clientX, y: e.clientY };
    pressed = false; // it was a swipe, not a tap
  });
  stage.addEventListener('pointerup', () => {
    if (pressed) onTap();
    pressed = false;
    swipe = null;
    menuSwipe = null;
  });
  for (const type of ['pointercancel', 'pointerleave']) {
    stage.addEventListener(type, () => {
      pressed = false;
      swipe = null;
      menuSwipe = null;
    });
  }

  root.querySelectorAll<HTMLElement>('[data-dir]').forEach((btn) => {
    const name = btn.dataset.dir as DirName;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      input.press(name);
      btn.classList.add('active');
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
      btn.addEventListener(type, () => {
        input.release(name);
        btn.classList.remove('active');
      });
    }
  });

  const smokeBtn = root.querySelector<HTMLElement>('[data-smoke]');
  if (smokeBtn) {
    smokeBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      input.setSmoke(true);
      smokeBtn.classList.add('active');
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
      smokeBtn.addEventListener(type, () => {
        input.setSmoke(false);
        smokeBtn.classList.remove('active');
      });
    }
  }
}
