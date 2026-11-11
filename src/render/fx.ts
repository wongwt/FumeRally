import * as THREE from 'three';
import { wx, wz } from './coords';

const ringGeo = new THREE.RingGeometry(0.8, 1, 28).rotateX(-Math.PI / 2);

interface Ring {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  age: number;
  life: number;
  max: number;
}

/** Short-lived visual effects. Right now: expanding rings for pickups and crashes. */
export class Fx {
  private rings: Ring[] = [];

  constructor(private readonly group: THREE.Group) {}

  ring(x: number, y: number, color: number, max = 1.4): void {
    const mesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    mesh.position.set(wx(x), 0.05, wz(y));
    this.group.add(mesh);
    this.rings.push({ mesh, age: 0, life: 0.5, max });
  }

  update(dt: number): void {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i] as Ring;
      r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) {
        this.remove(i);
        continue;
      }
      r.mesh.scale.setScalar(0.2 + t * r.max);
      r.mesh.material.opacity = 0.9 * (1 - t);
    }
  }

  clear(): void {
    while (this.rings.length) this.remove(this.rings.length - 1);
  }

  private remove(i: number): void {
    const [r] = this.rings.splice(i, 1) as [Ring];
    this.group.remove(r.mesh);
    r.mesh.material.dispose();
  }
}
