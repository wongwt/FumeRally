import { isChallengeMode, normCode, type ChallengeMode } from '../core/challenge';
import type { ViewMode } from '../render/cameraRig';
import { readJson, writeJson, type StorageLike } from './storage';

const CHALLENGE_KEY = 'fumeRallyChallenge';
const VIEW_KEY = 'fumeRallyView';

/** Player choices that survive a reload. (Language and mute are stored by their own modules.) */
export class Prefs {
  mode: ChallengeMode = 'normal';
  /** The last custom level code typed. */
  code = '';
  ghostOn = true;
  car = 'sedan';
  view: ViewMode = 'scroll';

  constructor(private readonly storage: StorageLike | null) {}

  load(): void {
    const c = readJson(this.storage, CHALLENGE_KEY);
    if (c) {
      if (isChallengeMode(c.mode)) this.mode = c.mode;
      if (typeof c.code === 'string') this.code = normCode(c.code);
      if (c.ghost === false) this.ghostOn = false;
      if (typeof c.car === 'string') this.car = c.car;
    }
    try {
      if (this.storage?.getItem(VIEW_KEY) === 'full') this.view = 'full';
    } catch {
      /* ignore */
    }
  }

  saveChallenge(): void {
    writeJson(this.storage, CHALLENGE_KEY, {
      mode: this.mode,
      code: this.code,
      ghost: this.ghostOn,
      car: this.car
    });
  }

  saveView(): void {
    try {
      this.storage?.setItem(VIEW_KEY, this.view);
    } catch {
      /* ignore */
    }
  }
}
