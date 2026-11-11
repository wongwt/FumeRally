import { START } from './config/constants';
import { buildMaze, mazeSeed, type Maze } from './core/maze';
import { fnv1a } from './core/rng';
import { getLang, initLang, LANGS, onLangChange, setLang, t, type Lang, type MessageKey } from './i18n';
import { Stage3D } from './render/stage3d';
import type { ViewMode } from './render/cameraRig';
import { COL } from './render/palette';
import { wx, wz } from './render/coords';
import { faceAngle, lerpAngle } from './core/math';
import * as THREE from 'three';

// M2 preview: the real 3D stage (maze meshes + both cameras) with a wandering marker standing in
// for the car so the follow camera has something to track. Driving arrives in M3.
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const banner = $('banner');

function showBanner(titleKey: MessageKey, bodyKey: MessageKey): void {
  banner.innerHTML = `<div class="panel"><h2>${t(titleKey)}</h2><p>${t(bodyKey)}</p></div>`;
  banner.hidden = false;
}

function renderText(): void {
  document.title = `${t('app.title')} ${t('app.subtitle')}`;
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n as MessageKey);
  }
  viewSelect.innerHTML = (['scroll', 'full'] as const)
    .map((v) => `<option value="${v}">${t(`view.${v}`)}</option>`)
    .join('');
  viewSelect.value = view;
}

const viewSelect = $<HTMLSelectElement>('view');
let view: ViewMode = 'scroll';
const langSelect = $<HTMLSelectElement>('lang');
langSelect.innerHTML = LANGS.map((l) => `<option value="${l.id}">${l.label}</option>`).join('');
langSelect.value = initLang();
langSelect.addEventListener('change', () => setLang(langSelect.value as Lang));
onLangChange(() => {
  langSelect.value = getLang();
  renderText();
  if (!banner.hidden) showBanner('error.webgl.title', 'error.webgl.body');
});
renderText();

let stage: Stage3D | null = null;
try {
  stage = new Stage3D($<HTMLCanvasElement>('gl'), $('stage'));
} catch {
  showBanner('error.webgl.title', 'error.webgl.body');
}

if (stage) {
  const s = stage;
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.2, 0.38),
    new THREE.MeshLambertMaterial({ color: COL.player })
  );
  marker.position.y = 0.17;
  const markerRoot = new THREE.Group();
  markerRoot.add(marker);
  s.actorGroup.add(markerRoot);

  // random walk over the open tiles
  const walker = { tx: START.x, ty: START.y, dx: 0, dy: -1, prog: 0, ang: faceAngle(0, -1) };
  let maze: Maze;
  const SPEED = 5.3;

  const loadLevel = (): void => {
    const level = Math.max(1, Math.min(99, Math.floor(Number($<HTMLInputElement>('level').value)) || 1));
    const code = $<HTMLInputElement>('code').value.trim().toUpperCase();
    maze = buildMaze(mazeSeed(level, code ? fnv1a(code) : 0, $<HTMLInputElement>('bonus').checked));
    s.setMaze(maze);
    Object.assign(walker, { tx: START.x, ty: START.y, dx: 0, dy: -1, prog: 0 });
    s.rig.snapTo(START.x, START.y);
  };

  const step = (dt: number): void => {
    let dist = SPEED * dt;
    while (dist > 1e-9) {
      if (walker.dx === 0 && walker.dy === 0) break;
      const remain = 1 - walker.prog;
      if (dist < remain) {
        walker.prog += dist;
        break;
      }
      dist -= remain;
      walker.tx += walker.dx;
      walker.ty += walker.dy;
      walker.prog = 0;
      const dirs = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0]
      ] as const;
      const open = dirs.filter(([x, y]) => maze.isOpen(walker.tx + x, walker.ty + y));
      const ahead = open.filter(([x, y]) => !(x === -walker.dx && y === -walker.dy));
      const pool = ahead.length ? ahead : open;
      const [nx, ny] = pool[Math.floor(Math.random() * pool.length)] as readonly [number, number];
      walker.dx = nx;
      walker.dy = ny;
    }
  };

  for (const id of ['level', 'code', 'bonus']) $(id).addEventListener('input', loadLevel);
  viewSelect.addEventListener('change', () => {
    view = viewSelect.value as ViewMode;
    s.rig.setView(view);
  });
  // expose for automated screenshots / debugging
  (window as unknown as { __stage: Stage3D }).__stage = s;
  loadLevel();

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt);
    const px = walker.tx + walker.dx * walker.prog;
    const py = walker.ty + walker.dy * walker.prog;
    markerRoot.position.set(wx(px), 0, wz(py));
    walker.ang = lerpAngle(walker.ang, faceAngle(walker.dx, walker.dy), 1 - Math.exp(-16 * dt));
    markerRoot.rotation.y = walker.ang;
    s.render(dt, px, py);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
