import * as THREE from 'three';
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
const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2fbff });

export interface CarModel {
  /** Root node: position it on the tile, rotate Y for heading. The car faces +X. */
  group: THREE.Group;
  /** Body paint; tint it for effects like invincibility or stun. */
  bodyMat: THREE.MeshLambertMaterial;
}

/** Builds the sedan: the base body style that other cars will vary (body, cabin, wheels, lamps). */
export function makeSedan(color: number, withStripe: boolean): CarModel {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const bl = 0.66; // body length
  const bh = 0.2;
  const bw = 0.38;
  const by = 0.17;
  const cw = 0.3; // cabin
  const ch = 0.15;
  const cd = 0.32;
  const cx = -0.05;

  const body = new THREE.Mesh(new THREE.BoxGeometry(bl, bh, bw), bodyMat);
  body.position.y = by;
  group.add(body);
  const topY = by + bh / 2;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), glassMat);
  cabin.position.set(cx, topY + ch / 2 - 0.005, 0);
  group.add(cabin);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(sx * bl * 0.32, 0.09, sz * (bw / 2 + 0.01));
      group.add(w);
    }
  }
  for (const sz of [-1, 1]) {
    const l = new THREE.Mesh(lampGeo, lampMat);
    l.position.set(bl / 2 + 0.005, by + 0.01, sz * Math.min(0.12, bw * 0.3));
    group.add(l);
  }
  if (withStripe) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(bl * 0.76, 0.004, 0.07), stripeMat);
    s.position.set(0, topY + 0.002, 0);
    group.add(s);
  }
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.012;
  shadow.scale.set(1.5, 1, 1.05);
  group.add(shadow);
  return { group, bodyMat };
}
