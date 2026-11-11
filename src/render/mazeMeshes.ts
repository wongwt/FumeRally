import * as THREE from 'three';
import { COLS, ROWS } from '../config/constants';
import type { Maze } from '../core/maze';
import { COL } from './palette';
import { wx, wz } from './coords';

const wallGeo = new THREE.BoxGeometry(1, 0.6, 1);
const capGeo = new THREE.BoxGeometry(0.88, 0.06, 0.88);
const laneGeo = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
const wallMat = new THREE.MeshLambertMaterial({ color: COL.wall });
const capMat = new THREE.MeshLambertMaterial({ color: COL.wallTop });
const laneMat = new THREE.MeshLambertMaterial({ color: COL.lane });

/** Replaces the contents of `group` with instanced meshes for walls, wall caps and open lanes. */
export function buildMazeMeshes(group: THREE.Group, maze: Maze): void {
  for (const m of group.children.slice()) {
    group.remove(m);
    if (m instanceof THREE.InstancedMesh) m.dispose();
  }
  const walls: [number, number][] = [];
  const lanes: [number, number][] = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) (maze.isOpen(x, y) ? lanes : walls).push([x, y]);

  const wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, walls.length);
  const capMesh = new THREE.InstancedMesh(capGeo, capMat, walls.length);
  const laneMesh = new THREE.InstancedMesh(laneGeo, laneMat, lanes.length);
  const m4 = new THREE.Matrix4();
  walls.forEach(([x, y], i) => {
    wallMesh.setMatrixAt(i, m4.makeTranslation(wx(x), 0.3, wz(y)));
    capMesh.setMatrixAt(i, m4.makeTranslation(wx(x), 0.63, wz(y)));
  });
  lanes.forEach(([x, y], i) => laneMesh.setMatrixAt(i, m4.makeTranslation(wx(x), 0.002, wz(y))));
  for (const m of [wallMesh, capMesh, laneMesh]) {
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    group.add(m);
  }
}
