import * as THREE from 'three';
import type { CarId } from '../config/cars';
import { COL } from './palette';

const wheelGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0b0f14 });
const lampGeo = new THREE.BoxGeometry(0.04, 0.05, 0.08);
const lampMat = new THREE.MeshBasicMaterial({ color: COL.lamp });
const glassMat = new THREE.MeshLambertMaterial({ color: COL.glass });
const shadowGeo = new THREE.CircleGeometry(0.3, 20).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.35,
  depthWrite: false
});
const starGeo = new THREE.SphereGeometry(0.05, 8, 6);
const starMat = new THREE.MeshBasicMaterial({ color: COL.gem });
const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2fbff });
const tankMat = new THREE.MeshLambertMaterial({ color: 0xcfd6da });
const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff3030 });
const blueLightMat = new THREE.MeshBasicMaterial({ color: 0x3060ff });

type SphereMesh = THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

export interface CarModel {
  /** Root node: position it on the tile, rotate Y for heading. The car faces +X. */
  group: THREE.Group;
  /** Body paint; tint it for effects like invincibility or stun. */
  bodyMat: THREE.MeshLambertMaterial;
  /** Three gold stars that circle above a stunned car; hidden by default. */
  stars: THREE.Group;
  /** Translucent sphere shown around the player while invincible (player cars only). */
  aura?: SphereMesh;
  /** Golden sphere shown while armor is up (player cars only). */
  shield?: SphereMesh;
}

export interface CarOptions {
  /** White racing stripe along the roof. */
  stripe?: boolean;
  /** Adds the invincibility aura and the armor shield. */
  player?: boolean;
}

/** Body proportions: [length, height, width, body y, cabin w, cabin h, cabin d, cabin x, wheel scale]. */
interface Shape {
  bl: number;
  bh: number;
  bw: number;
  by: number;
  cw: number;
  ch: number;
  cd: number;
  cx: number;
  ws: number;
}

const SEDAN: Shape = { bl: 0.66, bh: 0.2, bw: 0.38, by: 0.17, cw: 0.3, ch: 0.15, cd: 0.32, cx: -0.05, ws: 1 };
const SHAPES: Record<CarId, Shape> = {
  sedan: SEDAN,
  sport: { ...SEDAN, bl: 0.74, bh: 0.14, bw: 0.36, by: 0.14, cw: 0.26, ch: 0.1, cd: 0.28, cx: -0.08 },
  armor: {
    ...SEDAN,
    bl: 0.64,
    bh: 0.26,
    bw: 0.46,
    by: 0.2,
    cw: 0.28,
    ch: 0.12,
    cd: 0.3,
    cx: -0.04,
    ws: 1.25
  },
  offroad: { ...SEDAN, bl: 0.6, bw: 0.42, by: 0.25, cd: 0.34, cx: -0.04, ws: 1.5 },
  tanker: { ...SEDAN, bl: 0.76, bh: 0.15, bw: 0.4, by: 0.15, cw: 0.2, cd: 0.34, cx: 0.22, ws: 1.1 },
  scout: { ...SEDAN, bl: 0.6, bh: 0.16, bw: 0.36, by: 0.16, ch: 0.13, cd: 0.3, cx: -0.02 },
  police: SEDAN,
  moto: { ...SEDAN, bl: 0.6, bh: 0.08, bw: 0.1, by: 0.15, cw: 0.1, ch: 0.12, cd: 0.1, cx: -0.06, ws: 1.35 }
};

const box = (
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number
): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

/**
 * Builds one of the eight cars from simple boxes. Extra parts per type: spoiler (sport),
 * barrel and plates (armor), bull bar and roof rack (off-roader), fuel tank (tanker),
 * antenna (scout), light bar (police), rider (motorcycle).
 *
 * Geometries of the per-type extras are created per car and left to the garbage collector;
 * the shared ones (wheels, lamps...) are module-level and must never be disposed.
 */
export function makeCar(kind: CarId, color: number, options: CarOptions = {}): CarModel {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const { bl, bh, bw, by, cw, ch, cd, cx, ws } = SHAPES[kind];
  const topY = by + bh / 2;

  group.add(box(bl, bh, bw, bodyMat, 0, by, 0));
  group.add(box(cw, ch, cd, glassMat, cx, topY + ch / 2 - 0.005, 0));

  const wheelSpots: [number, number][] =
    kind === 'moto'
      ? [-1, 1].map((sx): [number, number] => [sx * bl * 0.36, 0])
      : [-1, 1].flatMap((sx) =>
          [-1, 1].map((sz): [number, number] => [sx * bl * 0.32, sz * (bw / 2 + 0.01)])
        );
  for (const [x, z] of wheelSpots) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.scale.set(ws, 1, ws);
    w.position.set(x, 0.09 * ws, z);
    group.add(w);
  }
  for (const sz of [-1, 1]) {
    const l = new THREE.Mesh(lampGeo, lampMat);
    l.position.set(bl / 2 + 0.005, by + 0.01, sz * Math.min(0.12, bw * 0.3));
    group.add(l);
  }
  if (options.stripe) group.add(box(bl * 0.76, 0.004, 0.07, stripeMat, 0, topY + 0.002, 0));

  switch (kind) {
    case 'sport':
      group.add(box(0.07, 0.015, bw + 0.04, bodyMat, -bl / 2 + 0.03, topY + 0.07, 0));
      for (const sz of [-1, 1])
        group.add(box(0.02, 0.07, 0.02, bodyMat, -bl / 2 + 0.03, topY + 0.035, sz * 0.12));
      break;
    case 'armor':
      group.add(box(0.26, 0.04, 0.04, glassMat, cx + 0.2, topY + ch / 2, 0));
      for (const sz of [-1, 1])
        group.add(box(bl * 0.7, 0.1, 0.03, bodyMat, 0, by + 0.01, sz * (bw / 2 + 0.005)));
      break;
    case 'offroad':
      group.add(box(0.04, 0.06, bw + 0.04, wheelMat, bl / 2 + 0.02, by - 0.02, 0));
      group.add(box(0.3, 0.03, 0.3, wheelMat, cx, topY + ch + 0.02, 0));
      break;
    case 'tanker': {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 14), tankMat);
      tank.rotation.z = Math.PI / 2;
      tank.position.set(-0.14, topY + 0.13, 0);
      group.add(tank);
      break;
    }
    case 'scout':
      group.add(box(0.02, 0.2, 0.02, wheelMat, -0.12, topY + ch + 0.1, 0));
      group.add(box(0.16, 0.025, 0.1, stripeMat, -0.12, topY + ch + 0.21, 0));
      break;
    case 'police':
      group.add(box(0.08, 0.05, 0.1, redLightMat, cx, topY + ch + 0.02, 0.07));
      group.add(box(0.08, 0.05, 0.1, blueLightMat, cx, topY + ch + 0.02, -0.07));
      break;
    case 'moto': {
      group.add(box(0.12, 0.2, 0.16, bodyMat, -0.08, topY + 0.14, 0));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), glassMat);
      head.position.set(-0.04, topY + 0.3, 0);
      group.add(head);
      break;
    }
    default:
      break;
  }

  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.012;
  shadow.scale.set(1.5, 1, 1.05);
  group.add(shadow);

  const stars = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const star = new THREE.Mesh(starGeo, starMat);
    const a = (i / 3) * Math.PI * 2;
    star.position.set(Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24);
    stars.add(star);
  }
  stars.position.y = 0.66;
  stars.visible = false;
  group.add(stars);

  const car: CarModel = { group, bodyMat, stars };
  if (options.player) {
    const sphere = (radius: number, colour: number, opacity: number): SphereMesh => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 12),
        new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false })
      );
      m.position.y = 0.25;
      m.visible = false;
      group.add(m);
      return m;
    };
    car.aura = sphere(0.5, 0xffffff, 0.22);
    car.shield = sphere(0.54, 0xffe29a, 0.2);
  }
  return car;
}
