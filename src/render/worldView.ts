import * as THREE from 'three';
import type { Gem, Rock } from '../sim/spawn';
import { wx, wz } from './coords';
import { COL } from './palette';
import type { Stage3D } from './stage3d';

const gemGeo = new THREE.OctahedronGeometry(0.22, 0).scale(1, 1.4, 1);
const gemMat = new THREE.MeshLambertMaterial({ color: COL.gem, emissive: 0x6b4a00 });
const rockGeo = new THREE.DodecahedronGeometry(0.34, 0);
const rockMat = new THREE.MeshPhongMaterial({ color: 0x9a948a, flatShading: true, shininess: 6 });

/** Meshes for the level's gems and rocks, kept in sync with the simulation's lists. */
export class WorldView {
  private readonly gemMeshes = new Map<Gem, THREE.Mesh>();
  private readonly rockMeshes = new Map<Rock, THREE.Mesh>();

  constructor(private readonly stage: Stage3D) {}

  /** Replaces all gem and rock meshes (new level). */
  rebuild(gems: readonly Gem[], rocks: readonly Rock[]): void {
    for (const m of this.gemMeshes.values()) this.stage.gemGroup.remove(m);
    for (const m of this.rockMeshes.values()) this.stage.rockGroup.remove(m);
    this.gemMeshes.clear();
    this.rockMeshes.clear();
    for (const g of gems) {
      const mesh = new THREE.Mesh(gemGeo, gemMat);
      mesh.position.set(wx(g.x), 0.38, wz(g.y));
      this.stage.gemGroup.add(mesh);
      this.gemMeshes.set(g, mesh);
    }
    for (const r of rocks) {
      const mesh = new THREE.Mesh(rockGeo, rockMat);
      mesh.position.set(wx(r.x), 0.27, wz(r.y));
      mesh.rotation.set(r.rx, r.ry, r.rz);
      mesh.scale.set(r.sx, 0.8, r.sz);
      this.stage.rockGroup.add(mesh);
      this.rockMeshes.set(r, mesh);
    }
  }

  removeGem(g: Gem): void {
    const m = this.gemMeshes.get(g);
    if (m) this.stage.gemGroup.remove(m);
    this.gemMeshes.delete(g);
  }

  removeRock(r: Rock): void {
    const m = this.rockMeshes.get(r);
    if (m) this.stage.rockGroup.remove(m);
    this.rockMeshes.delete(r);
  }

  /** Spins and bobs the gems. `time` is the simulation clock. */
  update(dt: number, time: number): void {
    for (const [g, m] of this.gemMeshes) {
      m.rotation.y += dt * 2.2;
      m.position.y = 0.38 + Math.sin(time * 3 + g.phase) * 0.06;
    }
  }
}
