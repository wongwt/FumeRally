import type { DirName } from '../config/constants';
import type { DirectionInput } from './directionInput';

export const KEY_DIR: Record<string, DirName> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right'
};

function isTyping(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

/** Wires arrow keys / WASD to the direction input. */
export function bindKeyboard(input: DirectionInput): void {
  window.addEventListener('keydown', (e) => {
    if (isTyping(e.target)) return;
    const dir = KEY_DIR[e.code];
    if (!dir) return;
    e.preventDefault();
    if (!e.repeat) input.press(dir);
  });
  window.addEventListener('keyup', (e) => {
    const dir = KEY_DIR[e.code];
    if (dir) input.release(dir);
  });
  window.addEventListener('blur', () => input.clear());
}
