import * as THREE from 'three';
import type { Maze } from '../core/maze';
import { CameraRig } from './cameraRig';
import { buildMazeMeshes } from './mazeMeshes';
import { COL } from './palette';
import { LEGACY_LIGHT } from './threeConfig';

/** Owns the WebGL renderer, scene graph and camera rig. */
export class Stage3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly mazeGroup = new THREE.Group();
  readonly rockGroup = new THREE.Group();
  readonly gemGroup = new THREE.Group();
  readonly actorGroup = new THREE.Group();
  readonly fxGroup = new THREE.Group();

  /** Throws if WebGL is unavailable; callers show a friendly message. */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: HTMLElement
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(COL.bg);
    this.scene.background = new THREE.Color(COL.bg);

    this.scene.add(new THREE.AmbientLight(0xcfe6ff, 0.72 * LEGACY_LIGHT));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85 * LEGACY_LIGHT);
    sun.position.set(-8, 16, 10);
    this.scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 30).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: COL.floor })
    );
    floor.position.y = -0.01;
    this.scene.add(floor);
    this.scene.add(this.mazeGroup, this.rockGroup, this.gemGroup, this.actorGroup, this.fxGroup);

    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.resize()).observe(host);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setMaze(maze: Maze): void {
    buildMazeMeshes(this.mazeGroup, maze);
    this.rig.setGrid(maze.cols, maze.rows);
  }

  resize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.rig.resize(w, h);
  }

  render(dt: number, focusTileX: number, focusTileY: number, shake = 0): void {
    this.rig.update(dt, focusTileX, focusTileY, shake);
    this.renderer.render(this.scene, this.rig.camera);
  }

  get width(): number {
    return this.host.clientWidth;
  }

  get height(): number {
    return this.host.clientHeight;
  }

  /** The canvas this stage draws to. */
  get element(): HTMLCanvasElement {
    return this.canvas;
  }
}
