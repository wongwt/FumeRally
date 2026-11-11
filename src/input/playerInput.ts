import { DIRS, type DirName, type Vec } from '../config/constants';

/** How long a buffered turn stays valid, so a slightly early key press still turns at the next junction. */
const KEY_BUFFER = 0.4;
const SWIPE_BUFFER = 0.7;

/**
 * Turns raw presses (keys, d-pad, swipes) into one "wanted" direction, plus the smoke button.
 * The last key held wins; a tap is remembered briefly so the car turns at the next junction.
 */
export class PlayerInput {
  private readonly held: DirName[] = [];
  private current: Vec | null = null;
  private timer = 0;
  /** True while the exhaust button (Space / on-screen) is held. */
  smoke = false;

  get want(): Vec | null {
    return this.current;
  }

  press(name: DirName): void {
    this.release(name, false);
    this.held.push(name);
    this.current = DIRS[name];
    this.timer = KEY_BUFFER;
  }

  release(name: DirName, fallback = true): void {
    const i = this.held.indexOf(name);
    if (i >= 0) this.held.splice(i, 1);
    if (fallback && this.held.length) this.current = DIRS[this.held[this.held.length - 1] as DirName];
  }

  /** A swipe has no release event, so it simply expires. */
  swipe(name: DirName): void {
    this.current = DIRS[name];
    this.timer = SWIPE_BUFFER;
  }

  /** Call once per simulation step. */
  update(dt: number): void {
    const top = this.held[this.held.length - 1];
    if (top) {
      this.timer = KEY_BUFFER;
      this.current = DIRS[top];
    } else if (this.current) {
      this.timer -= dt;
      if (this.timer <= 0) this.current = null;
    }
  }

  /** Forget everything, e.g. when the window loses focus and key-up events would be missed. */
  clear(): void {
    this.held.length = 0;
    this.current = null;
    this.timer = 0;
    this.smoke = false;
  }
}
