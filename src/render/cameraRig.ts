import * as THREE from 'three';
import { COLS, ROWS } from '../config/constants';
import { wx, wz } from './coords';

export type ViewMode = 'full' | 'scroll';

const TILT = 0.42;

/**
 * 'full'  : the whole maze on one screen.
 * 'scroll': a close window that follows the car (the radar shows the full map).
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  view: ViewMode = 'scroll';
  /** Multiplier on the follow window size; scout cars see further. */
  viewScale = 1;
  /** Half extents (in tiles) of the area currently framed. */
  halfW = COLS / 2;
  halfH = ROWS / 2;
  private readonly target = new THREE.Vector3();
  private dist = 40;
  private aspect = 1;

  /** World-space point the camera looks at. */
  get focus(): THREE.Vector3 {
    return this.target;
  }

  resize(width: number, height: number): void {
    this.aspect = Math.max(1, width) / Math.max(1, height);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.refit();
  }

  setView(view: ViewMode): void {
    this.view = view;
    this.refit();
  }

  setViewScale(scale: number): void {
    this.viewScale = scale;
    this.refit();
  }

  /** Recomputes the framed area and camera distance after a resize or view change. */
  refit(): void {
    this.halfW = COLS / 2;
    this.halfH = ROWS / 2;
    if (this.view === 'scroll') {
      const hh = Math.min(ROWS / 2, 5.6 * this.viewScale);
      const hw = hh * this.aspect;
      if (hw < COLS / 2) {
        this.halfH = hh;
        this.halfW = hw;
      }
    }
    this.dist = this.solveDist(this.halfW, this.halfH);
  }

  /** Jumps straight to a tile position (no easing), e.g. when a level loads. */
  snapTo(tileX: number, tileY: number): void {
    this.target.copy(this.desiredTarget(tileX, tileY));
  }

  /** Moves the camera towards the tile position (the player's) and applies optional shake. */
  update(dt: number, tileX: number, tileY: number, shake = 0): void {
    const want = this.desiredTarget(tileX, tileY);
    const k = this.view === 'scroll' ? 1 - Math.exp(-9 * dt) : 1;
    this.target.x += (want.x - this.target.x) * k;
    this.target.z += (want.z - this.target.z) * k;
    const ox = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const oy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    this.camera.position.set(
      this.target.x + ox,
      Math.cos(TILT) * this.dist + oy,
      this.target.z + Math.sin(TILT) * this.dist
    );
    this.camera.lookAt(this.target.x, 0, this.target.z);
  }

  /** Projects a tile position to normalised device coordinates (for HTML popups). */
  project(tileX: number, tileY: number, height = 0.6): THREE.Vector3 {
    this.camera.updateMatrixWorld();
    return new THREE.Vector3(wx(tileX), height, wz(tileY)).project(this.camera);
  }

  private desiredTarget(tileX: number, tileY: number): THREE.Vector3 {
    let tx = 0;
    let tz = 0;
    if (this.view === 'scroll') {
      const mx = Math.max(0, COLS / 2 - this.halfW);
      const mz = Math.max(0, ROWS / 2 - this.halfH);
      tx = Math.max(-mx, Math.min(mx, wx(tileX)));
      tz = Math.max(-mz, Math.min(mz, wz(tileY)));
    }
    return new THREE.Vector3(tx, 0, tz);
  }

  /** Smallest camera distance at which the whole framed box fits on screen. */
  private solveDist(halfW: number, halfH: number): number {
    const pts: THREE.Vector3[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1])
        for (const y of [0, 0.7]) pts.push(new THREE.Vector3(sx * halfW, y, sz * halfH));
    }
    const cam = this.camera;
    const savedPos = cam.position.clone();
    let dist = 6;
    for (let i = 0; i < 700; i++) {
      cam.position.set(0, Math.cos(TILT) * dist, Math.sin(TILT) * dist);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld(true);
      if (
        pts.every((p) => {
          const v = p.clone().project(cam);
          return Math.abs(v.x) <= 0.985 && Math.abs(v.y) <= 0.985;
        })
      )
        break;
      dist *= 1.012;
    }
    cam.position.copy(savedPos);
    return dist;
  }
}
