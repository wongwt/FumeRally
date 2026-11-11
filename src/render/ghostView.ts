import * as THREE from 'three';
import { lerpAngle } from '../core/math';
import { ghostAt } from '../sim/ghost';
import type { Sim } from '../sim/sim';
import { wx, wz } from './coords';
import type { Stage3D } from './stage3d';

const bodyGeo = new THREE.BoxGeometry(0.66, 0.2, 0.38);
const cabinGeo = new THREE.BoxGeometry(0.3, 0.15, 0.32);
const ghostMat = new THREE.MeshBasicMaterial({
  color: 0xbfe9ff,
  transparent: true,
  opacity: 0.38,
  depthWrite: false
});

/** A see-through car replaying the best run of this stage. */
export class GhostView {
  private readonly group = new THREE.Group();
  private heading = 0;

  constructor(stage: Stage3D) {
    const body = new THREE.Mesh(bodyGeo, ghostMat);
    body.position.y = 0.17;
    const cabin = new THREE.Mesh(cabinGeo, ghostMat);
    cabin.position.set(-0.05, 0.34, 0);
    this.group.add(body, cabin);
    this.group.visible = false;
    stage.actorGroup.add(this.group);
  }

  update(dt: number, sim: Sim): void {
    const ghost = sim.ghost;
    const phase = sim.phase;
    const show =
      !!ghost &&
      sim.ghostOn &&
      !sim.bonus &&
      (phase === 'ready' || phase === 'play' || phase === 'dying' || phase === 'paused');
    this.group.visible = show;
    if (!show || !ghost) return;
    const pose = ghostAt(ghost, sim.lvT);
    if (!pose) {
      this.group.visible = false;
      return;
    }
    this.group.position.set(wx(pose.x), 0, wz(pose.y));
    if (pose.dx !== 0 || pose.dy !== 0) {
      this.heading = lerpAngle(this.heading, Math.atan2(-pose.dy, pose.dx), 1 - Math.exp(-14 * dt));
    }
    this.group.rotation.y = this.heading;
  }
}
