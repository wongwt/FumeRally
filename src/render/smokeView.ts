import * as THREE from 'three';
import type { Cloud } from '../sim/sim';
import { wx, wz } from './coords';
import { COL } from './palette';
import { CLOUD_LIFE } from '../config/constants';

const smokeGeo = new THREE.SphereGeometry(0.28, 10, 8);

interface CloudMesh {
  group: THREE.Group;
  mat: THREE.MeshBasicMaterial;
  puffs: { mesh: THREE.Mesh; size: number }[];
}

/** Draws the sim's exhaust clouds as little clusters of fading, growing spheres. */
export class SmokeView {
  private readonly meshes = new Map<Cloud, CloudMesh>();

  constructor(private readonly group: THREE.Group) {}

  /** Syncs meshes with the sim's current cloud list and animates them. */
  update(clouds: readonly Cloud[]): void {
    for (const [cloud, m] of this.meshes) {
      if (clouds.includes(cloud)) continue;
      this.group.remove(m.group);
      m.mat.dispose();
      this.meshes.delete(cloud);
    }
    for (const cloud of clouds) {
      let m = this.meshes.get(cloud);
      if (!m) {
        m = this.create(cloud);
        this.meshes.set(cloud, m);
      }
      const t = Math.min(1, cloud.age / CLOUD_LIFE);
      for (const p of m.puffs) p.mesh.scale.setScalar(p.size * (1 + t * 1.6));
      m.mat.opacity = 0.8 * (1 - t) * Math.min(1, t / 0.08);
      m.group.position.y = t * 0.2;
    }
  }

  clear(): void {
    this.update([]);
  }

  private create(cloud: Cloud): CloudMesh {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: COL.smoke,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    const puffs: CloudMesh['puffs'] = [];
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(smokeGeo, mat);
      const size = 0.5 + Math.random() * 0.4;
      mesh.position.set((Math.random() - 0.5) * 0.5, 0.2 + Math.random() * 0.15, (Math.random() - 0.5) * 0.5);
      mesh.scale.setScalar(size);
      group.add(mesh);
      puffs.push({ mesh, size });
    }
    group.position.set(wx(cloud.x), 0, wz(cloud.y));
    this.group.add(group);
    return { group, mat, puffs };
  }
}
