import {
  activeCode,
  challengeKey,
  challengeSeed,
  isChallengeValid,
  normCode,
  randomCode,
  type ChallengeMode
} from '../core/challenge';
import type { Prefs } from '../storage/prefs';

/** Which challenge is selected (normal, daily or a custom code) and the keys derived from it. */
export class ChallengeState {
  constructor(
    private readonly prefs: Prefs,
    /** Injectable clock, so the daily code can be tested. */
    private readonly now: () => Date = () => new Date()
  ) {}

  get mode(): ChallengeMode {
    return this.prefs.mode;
  }

  /** The custom code as typed (normalised), even while another mode is selected. */
  get customCode(): string {
    return this.prefs.code;
  }

  /** The code in effect: today's for daily, the typed one for custom, '' for normal. */
  get code(): string {
    return activeCode(this.mode, this.prefs.code, this.now());
  }

  get key(): string {
    return challengeKey(this.mode, this.prefs.code, this.now());
  }

  get seed(): number {
    return challengeSeed(this.key);
  }

  get valid(): boolean {
    return isChallengeValid(this.mode, this.prefs.code);
  }

  setMode(mode: ChallengeMode): void {
    this.prefs.mode = mode;
    this.prefs.saveChallenge();
  }

  setCode(code: string): void {
    this.prefs.code = normCode(code);
    this.prefs.saveChallenge();
  }

  /** Switches to a fresh random custom code and returns it. */
  randomize(rand: () => number = Math.random): string {
    this.prefs.mode = 'custom';
    this.prefs.code = randomCode(rand);
    this.prefs.saveChallenge();
    return this.prefs.code;
  }
}
