import type { DirName } from '../config/constants';
import type { DirectionInput } from './directionInput';

const SWIPE_DISTANCE = 24;

/** Swipe on the stage and on-screen d-pad buttons (`<button data-dir="up|down|left|right">`). */
export function bindTouch(input: DirectionInput, stage: HTMLElement, root: ParentNode = document): void {
  let swipe: { x: number; y: number } | null = null;
  stage.addEventListener('pointerdown', (e) => {
    stage.focus({ preventScroll: true });
    if (e.pointerType === 'touch') swipe = { x: e.clientX, y: e.clientY };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (Math.hypot(dx, dy) < SWIPE_DISTANCE) return;
    input.swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    swipe = { x: e.clientX, y: e.clientY };
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave'])
    stage.addEventListener(type, () => (swipe = null));

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
}
