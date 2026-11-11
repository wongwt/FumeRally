import type { DirName } from '../config/constants';
import type { PlayerInput } from './playerInput';

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

export interface KeyActions {
  /** Space or Enter: start a game, resume from pause. */
  confirm(): void;
  /** P or Escape. */
  pause(): void;
  /** V. */
  toggleView(): void;
}

function isTyping(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

/** Wires arrow keys / WASD to the direction input and the other keys to game actions. */
export function bindKeyboard(input: PlayerInput, actions: KeyActions): void {
  window.addEventListener('keydown', (e) => {
    if (isTyping(e.target)) return;
    const dir = KEY_DIR[e.code];
    if (dir || e.code === 'Space') e.preventDefault();
    if (dir) {
      if (!e.repeat) input.press(dir);
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') actions.confirm();
    else if (e.code === 'KeyP' || e.code === 'Escape') actions.pause();
    else if (e.code === 'KeyV') actions.toggleView();
  });
  window.addEventListener('keyup', (e) => {
    const dir = KEY_DIR[e.code];
    if (dir) input.release(dir);
  });
  window.addEventListener('blur', () => input.clear());
}
