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
  /** Space or Enter: start a game or resume from pause. Returns true if it did either. */
  confirm(): boolean;
  /** P or Escape. */
  pause(): void;
  /** V. */
  toggleView(): void;
  /** M. */
  toggleMute(): void;
  /** A dialog is open: it takes Space / Enter / Escape and swallows everything else. */
  modalOpen(): boolean;
  closeModal(): void;
  /** Arrow keys on the title / game-over screens (stage picker). Return true to swallow the key. */
  menuDir(dir: DirName): boolean;
}

function isTyping(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

/** Wires arrow keys / WASD to the direction input and the other keys to game actions. */
export function bindKeyboard(input: PlayerInput, actions: KeyActions): void {
  window.addEventListener('keydown', (e) => {
    if (isTyping(e.target)) return;
    if (actions.modalOpen()) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        actions.closeModal();
      }
      return;
    }
    const dir = KEY_DIR[e.code];
    if (dir || e.code === 'Space') e.preventDefault();
    if (dir) {
      if (e.repeat) return;
      if (!actions.menuDir(dir)) input.press(dir);
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      // Space doubles as the exhaust button, but not on the press that starts or resumes a game.
      if (!actions.confirm() && e.code === 'Space') input.setSmoke(true);
    } else if (e.code === 'KeyP' || e.code === 'Escape') actions.pause();
    else if (e.code === 'KeyV') actions.toggleView();
    else if (e.code === 'KeyM') actions.toggleMute();
  });
  window.addEventListener('keyup', (e) => {
    const dir = KEY_DIR[e.code];
    if (dir) input.release(dir);
    else if (e.code === 'Space') input.setSmoke(false);
  });
  window.addEventListener('blur', () => input.clear());
}
