import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COLS, ROWS } from '../src/config/constants';
import { buildMaze, mazeSeed } from '../src/core/maze';
import { CameraRig } from '../src/render/cameraRig';
import { wx, wz } from '../src/render/coords';
import { buildMazeMeshes } from '../src/render/mazeMeshes';

describe('coords', () => {
  it('centres the maze on the origin', () => {
    expect(wx(0) + wx(COLS - 1)).toBeCloseTo(0);
    expect(wz(0) + wz(ROWS - 1)).toBeCloseTo(0);
    expect(wx(1) - wx(0)).toBe(1);
  });
});

describe('buildMazeMeshes', () => {
  const maze = buildMaze(mazeSeed(1, 0, false));
  const walls = maze.cells.filter((c) => c === 1).length;

  it('creates one instance per wall, cap and lane tile', () => {
    const group = new THREE.Group();
    buildMazeMeshes(group, maze);
    const counts = group.children.map((c) => (c as THREE.InstancedMesh).count).sort((a, b) => a - b);
    expect(counts).toEqual([COLS * ROWS - walls, walls, walls].sort((a, b) => a - b));
  });

  it('replaces the previous maze instead of piling up meshes', () => {
    const group = new THREE.Group();
    buildMazeMeshes(group, maze);
    buildMazeMeshes(group, buildMaze(mazeSeed(2, 0, false)));
    expect(group.children).toHaveLength(3);
  });
});

describe('CameraRig', () => {
  const insideScreen = (rig: CameraRig, halfW: number, halfH: number): boolean => {
    rig.camera.updateMatrixWorld(true);
    return [-1, 1].every((sx) =>
      [-1, 1].every((sz) => {
        const v = new THREE.Vector3(rig.focus.x + sx * halfW, 0, rig.focus.z + sz * halfH).project(
          rig.camera
        );
        return Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
      })
    );
  };

  it('full view frames the whole maze for common aspect ratios', () => {
    for (const [w, h] of [
      [1280, 720],
      [800, 800],
      [390, 600]
    ] as const) {
      const rig = new CameraRig();
      rig.setView('full');
      rig.resize(w, h);
      rig.update(1, 5, 5);
      expect(rig.halfW).toBe(COLS / 2);
      expect(rig.halfH).toBe(ROWS / 2);
      expect(insideScreen(rig, COLS / 2, ROWS / 2)).toBe(true);
    }
  });

  it('follow view shows a smaller window that scales with viewScale', () => {
    const rig = new CameraRig();
    rig.resize(1280, 720);
    expect(rig.halfH).toBeCloseTo(5.6);
    expect(rig.halfW).toBeLessThan(COLS / 2);
    rig.setViewScale(1.3);
    expect(rig.halfH).toBeCloseTo(5.6 * 1.3);
  });

  it('follow view falls back to the full maze on very wide stages', () => {
    const rig = new CameraRig();
    rig.resize(2400, 600);
    expect(rig.halfW).toBe(COLS / 2);
  });

  it('follow view tracks the player but stays inside the maze', () => {
    const rig = new CameraRig();
    rig.resize(1280, 720);
    rig.snapTo(0, 0);
    expect(rig.focus.x).toBeCloseTo(-(COLS / 2 - rig.halfW));
    expect(rig.focus.z).toBeCloseTo(-(ROWS / 2 - rig.halfH));
    rig.snapTo(13, 9);
    expect(rig.focus.x).toBeCloseTo(0);
    expect(rig.focus.z).toBeCloseTo(0);
  });

  it('eases towards the target in follow view and jumps in full view', () => {
    const rig = new CameraRig();
    rig.resize(1280, 720);
    rig.snapTo(13, 9);
    rig.update(1 / 60, 20, 9);
    const wanted = Math.min(wx(20), COLS / 2 - rig.halfW);
    expect(rig.focus.x).toBeGreaterThan(0);
    expect(rig.focus.x).toBeLessThan(wanted);
    rig.setView('full');
    rig.update(1 / 60, 20, 9);
    expect(rig.focus.x).toBeCloseTo(0);
  });
});
