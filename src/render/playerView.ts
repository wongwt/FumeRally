import { faceAngle, lerpAngle } from '../core/math';
import { posX, posY } from '../sim/movement';
import type { Sim } from '../sim/sim';
import { makeSedan } from './carModel';
import { wx, wz } from './coords';
import { COL } from './palette';
import type { Stage3D } from './stage3d';

/** The player's car: follows the sim, spins away when crashing and goes rainbow when invincible. */
export class PlayerView {
  private readonly car = makeSedan(COL.player, true, true);
  private heading = faceAngle(0, -1);
  private powered = false;
  private baseColor: number = COL.player;

  constructor(stage: Stage3D) {
    stage.actorGroup.add(this.car.group);
  }

  /**
   * The car is back on the start tile: undo the crash animation and face the right way.
   * The sim announces this while it is still in its 'dying' phase, so do not go through `update`,
   * which would apply the shrinking animation again.
   */
  reset(sim: Sim): void {
    const g = this.car.group;
    this.heading = faceAngle(sim.player.fx, sim.player.fy);
    g.scale.setScalar(1);
    g.visible = true;
    g.position.set(wx(posX(sim.player)), 0, wz(posY(sim.player)));
    g.rotation.y = this.heading;
  }

  update(dt: number, sim: Sim): void {
    const g = this.car.group;
    g.position.set(wx(posX(sim.player)), 0, wz(posY(sim.player)));
    if (sim.phase === 'dying') {
      // spin and shrink away
      g.rotation.y += dt * 14;
      g.scale.setScalar(Math.max(0.01, 1 - Math.min(1, sim.stateT / 0.9)));
    } else {
      // outside the crash animation the car is always full size, whatever happened before
      if (g.scale.x !== 1) g.scale.setScalar(1);
      this.heading = lerpAngle(this.heading, faceAngle(sim.player.fx, sim.player.fy), 1 - Math.exp(-16 * dt));
      g.rotation.y = this.heading;
    }
    this.applyPowerLook(sim);
  }

  /** Rainbow body and a halo while invincible; they blink during the last 1.6 seconds. */
  private applyPowerLook(sim: Sim): void {
    const { bodyMat, aura } = this.car;
    if (sim.power > 0) {
      const blink = sim.power < 1.6 && Math.floor(sim.time * 10) % 2 === 0;
      const hue = (sim.time * 1.6) % 1;
      bodyMat.color.setHSL(hue, 0.9, blink ? 0.85 : 0.6);
      if (aura) {
        aura.visible = !blink;
        aura.material.color.setHSL(hue, 0.9, 0.7);
      }
      this.powered = true;
    } else if (this.powered) {
      bodyMat.color.setHex(this.baseColor);
      if (aura) aura.visible = false;
      this.powered = false;
    }
  }
}
