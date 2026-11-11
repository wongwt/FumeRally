import type { DirName } from '../config/constants';
import type { PlayerInput } from './playerInput';

const SWIPE_DISTANCE = 24;

/** Swipe on the stage, the on-screen d-pad (`data-dir`) and the exhaust button (`data-smoke`). */
export function bindTouch(
  input: PlayerInput,
  stage: HTMLElement,
  /** Called for a tap or click on the stage (start, resume). */
  onTap: () => void,
  root: ParentNode = document
): void {
  let swipe: { x: number; y: number } | null = null;
  let pressed = false;
  stage.addEventListener('pointerdown', (e) => {
    stage.focus({ preventScroll: true });
    pressed = true;
    if (e.pointerType === 'touch') swipe = { x: e.clientX, y: e.clientY };
  });
  stage.addEventListener('pointermove', (e) => {
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
  });
  for (const type of ['pointercancel', 'pointerleave']) {
    stage.addEventListener(type, () => {
      pressed = false;
      swipe = null;
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
