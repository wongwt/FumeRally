import type { Emitter } from '../core/events';
import type { SimEvents } from '../sim/sim';
import type { AudioEngine } from './engine';

/** The game's sound effects. Pitches and envelopes are carried over from the PoC. */
export interface SoundBank {
  /** `mult` is the combo multiplier at pickup: the chime rises with the chain. */
  gem(mult: number): void;
  puff(): void;
  stun(): void;
  crash(): void;
  clear(): void;
  go(): void;
  empty(): void;
  power(): void;
  smash(): void;
}

export class Sfx implements SoundBank {
  constructor(private readonly a: AudioEngine) {}

  gem(mult: number): void {
    const base = 520 + mult * 70;
    this.a.tone(base, 0.07, 'square', 0.05);
    this.a.tone(base * 1.5, 0.1, 'square', 0.05, 0, 0.07);
  }
  puff(): void {
    this.a.noise(0.28, 0.09, 700);
  }
  stun(): void {
    this.a.tone(260, 0.28, 'sawtooth', 0.06, -150);
  }
  crash(): void {
    this.a.tone(380, 0.7, 'sawtooth', 0.07, -320);
    this.a.noise(0.5, 0.12, 1200);
  }
  clear(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.a.tone(f, 0.16, 'square', 0.05, 0, i * 0.12));
  }
  go(): void {
    this.a.tone(660, 0.12, 'square', 0.05);
    this.a.tone(990, 0.2, 'square', 0.05, 0, 0.14);
  }
  empty(): void {
    this.a.tone(140, 0.1, 'square', 0.04);
  }
  power(): void {
    [392, 523, 659, 784, 1047].forEach((f, i) => this.a.tone(f, 0.1, 'square', 0.05, 0, i * 0.06));
  }
  smash(): void {
    this.a.noise(0.22, 0.12, 500);
    this.a.tone(150, 0.18, 'square', 0.06, -80);
  }
}

/** Plays the right sound for each thing the simulation announces. */
export function bindSfx(events: Emitter<SimEvents>, sfx: SoundBank): void {
  events.on('gemTaken', ({ mult }) => sfx.gem(mult));
  events.on('puff', () => sfx.puff());
  events.on('puffEmpty', () => sfx.empty());
  events.on('enemyStunned', () => sfx.stun());
  events.on('enemyKnocked', () => sfx.stun());
  events.on('crash', () => sfx.crash());
  events.on('levelClear', () => sfx.clear());
  events.on('bonusEnd', () => sfx.clear());
  events.on('go', () => sfx.go());
  events.on('powerUp', () => sfx.power());
  events.on('rockSmashed', () => sfx.smash());
}
