import * as THREE from 'three';
import type { Special } from '../sim/sim';
import { wx, wz } from './coords';
import type { Stage3D } from './stage3d';

const coreGeo = new THREE.OctahedronGeometry(0.3, 0).scale(1, 1.3, 1);
const haloGeo = new THREE.TorusGeometry(0.36, 0.03, 8, 24).rotateX(Math.PI / 2);
const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });

/** The rainbow gem: a spinning, bobbing, colour-cycling jewel with a halo. */
export class SpecialView {
  private mesh: THREE.Group | null = null;
  private shown: Special | null = null;

  constructor(private readonly stage: Stage3D) {}

  /** Syncs with the sim's rainbow gem (or lack of one) and animates it. */
  update(dt: number, time: number, special: Special | null): void {
    if (special !== this.shown) {
      if (this.mesh) this.stage.gemGroup.remove(this.mesh);
      this.mesh = null;
      this.shown = special;
      if (special) {
        this.mesh = new THREE.Group();
        this.mesh.add(new THREE.Mesh(coreGeo, coreMat), new THREE.Mesh(haloGeo, haloMat));
        this.mesh.position.set(wx(special.x), 0.42, wz(special.y));
        this.stage.gemGroup.add(this.mesh);
      }
    }
    if (!this.mesh) return;
    this.mesh.rotation.y += dt * 2.6;
    this.mesh.position.y = 0.42 + Math.sin(time * 3.4) * 0.07;
    const hue = (time * 0.8) % 1;
    coreMat.color.setHSL(hue, 0.9, 0.6);
    haloMat.color.setHSL((hue + 0.5) % 1, 0.9, 0.7);
  }
}
