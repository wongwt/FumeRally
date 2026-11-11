import { COLS, HOMES, ROWS, START } from './config/constants';
import { buildMaze, mazeSeed } from './core/maze';
import { Pathfinder, UNREACHED } from './core/pathfinding';
import { fnv1a } from './core/rng';
import { getLang, initLang, LANGS, onLangChange, setLang, t, type Lang, type MessageKey } from './i18n';

// M1 preview: a 2D look at the seeded maze generator, BFS and i18n. The 3D scene arrives in M2.
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('preview');
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const TILE = 26;
canvas.width = COLS * TILE;
canvas.height = ROWS * TILE;
const pathfinder = new Pathfinder(COLS, ROWS);

function draw(): void {
  const level = Math.max(1, Math.min(99, Math.floor(Number($<HTMLInputElement>('level').value)) || 1));
  const code = $<HTMLInputElement>('code').value.trim().toUpperCase();
  const bonus = $<HTMLInputElement>('bonus').checked;
  const heat = $<HTMLInputElement>('heat').checked;
  const seed = code ? fnv1a(code) : 0;
  const maze = buildMaze(mazeSeed(level, seed, bonus));
  const dist = heat ? pathfinder.fill(START.x, START.y, (x, y) => maze.isOpen(x, y)) : null;
  let far = 1;
  if (dist) for (const d of dist) if (d < UNREACHED && d > far) far = d;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const d = dist ? (dist[y * COLS + x] as number) : UNREACHED;
      ctx.fillStyle = !maze.isOpen(x, y)
        ? '#17394f'
        : d < UNREACHED
          ? `hsl(${200 - (d / far) * 160} 60% 28%)`
          : '#123044';
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  const mark = (x: number, y: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x * TILE + 7, y * TILE + 7, TILE - 14, TILE - 14);
  };
  for (const h of HOMES) mark(h.x, h.y, '#ff5b4b');
  mark(START.x, START.y, '#37c6ff');
  $('info').textContent =
    `seed ${mazeSeed(level, seed, bonus)} · ${maze.cells.filter((c) => c === 0).length} open tiles`;
}

function renderText(): void {
  document.title = `${t('app.title')} ${t('app.subtitle')}`;
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n as MessageKey);
  }
  const keys: MessageKey[] = [
    'hud.score',
    'hud.hi',
    'hud.level',
    'hud.combo',
    'hud.lives',
    'hud.gems',
    'hud.power',
    'hud.time',
    'hud.fuel'
  ];
  $('hud-labels').innerHTML = keys.map((k) => `<div><dt>${t(k)}</dt><dd>000000</dd></div>`).join('');
}

const select = $<HTMLSelectElement>('lang');
select.innerHTML = LANGS.map((l) => `<option value="${l.id}">${l.label}</option>`).join('');
select.value = initLang();
select.addEventListener('change', () => setLang(select.value as Lang));
onLangChange(() => {
  select.value = getLang();
  renderText();
});
for (const id of ['level', 'code', 'bonus', 'heat']) $(id).addEventListener('input', draw);

renderText();
draw();
