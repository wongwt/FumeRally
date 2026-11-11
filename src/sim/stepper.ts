/**
 * Fixed-timestep accumulator. The simulation always advances in equal `step` slices, so
 * gameplay does not depend on the display's refresh rate. A long frame (tab switch, breakpoint)
 * is clamped to `maxFrame` so the game never tries to "catch up" with a huge burst.
 */
export class FixedStepper {
  private acc = 0;

  constructor(
    readonly step: number,
    readonly maxFrame: number
  ) {}

  /** Feeds a frame time and runs `update(step)` as many times as needed. Returns the step count. */
  advance(frameDt: number, update: (dt: number) => void): number {
    this.acc += Math.min(Math.max(0, frameDt), this.maxFrame);
    let n = 0;
    while (this.acc >= this.step) {
      this.acc -= this.step;
      update(this.step);
      n++;
    }
    return n;
  }

  reset(): void {
    this.acc = 0;
  }
}
