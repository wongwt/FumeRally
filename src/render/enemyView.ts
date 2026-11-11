import { faceAngle, lerpAngle } from '../core/math';
import type { Enemy } from '../sim/enemies';
import { posX, posY } from '../sim/movement';
import { makeCar, type CarModel } from './carModel';
import { wx, wz } from './coords';
import { COL } from './palette';
import type { Stage3D } from './stage3d';

const STUN_COLORS = [0x7d93a3, 0xa9bbc7] as const;

/** Red chaser cars. Stunned chasers wobble, flash grey and wear spinning stars. */
export class EnemyView {
  private readonly cars: CarModel[];
  private readonly headings: number[];

  constructor(
    stage: Stage3D,
    private readonly enemies: readonly Enemy[]
  ) {
    this.cars = enemies.map(() => {
      const car = makeCar('sedan', COL.enemy);
      stage.actorGroup.add(car.group);
      return car;
    });
    this.headings = enemies.map(() => faceAngle(0, 1));
  }

  /** Face every chaser the way the sim says, without easing (after a respawn). */
  snapHeadings(): void {
    this.enemies.forEach((en, i) => (this.headings[i] = faceAngle(en.fx, en.fy)));
  }

  update(dt: number, time: number): void {
    this.enemies.forEach((en, i) => {
      const car = this.cars[i] as CarModel;
      car.group.visible = en.active;
      if (!en.active) return;
      car.group.position.set(wx(posX(en)), 0, wz(posY(en)));
      const heading = lerpAngle(this.headings[i] as number, faceAngle(en.fx, en.fy), 1 - Math.exp(-16 * dt));
      this.headings[i] = heading;
      const stunned = en.stun > 0;
      car.group.rotation.y = heading + (stunned ? Math.sin(time * 30) * 0.15 : 0);
      car.stars.visible = stunned;
      if (stunned) car.stars.rotation.y += dt * 6;
      car.bodyMat.color.setHex(stunned ? (STUN_COLORS[Math.floor(time * 8) % 2] as number) : COL.enemy);
    });
  }
}
