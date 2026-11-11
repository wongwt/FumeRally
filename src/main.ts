import { fnv1a } from './core/rng';
import { Game } from './game/game';
import { getLang, initLang, LANGS, onLangChange, setLang, t, type Lang, type MessageKey } from './i18n';
import { bindKeyboard } from './input/keyboard';
import { bindTouch } from './input/touch';
import type { ViewMode } from './render/cameraRig';
import { Stage3D } from './render/stage3d';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const banner = $('banner');
const viewSelect = $<HTMLSelectElement>('view');
const langSelect = $<HTMLSelectElement>('lang');
let view: ViewMode = 'scroll';
let webglFailed = false;

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
  if (webglFailed) showBanner('error.webgl.title', 'error.webgl.body');
}

langSelect.innerHTML = LANGS.map((l) => `<option value="${l.id}">${l.label}</option>`).join('');
langSelect.value = initLang();
langSelect.addEventListener('change', () => {
  setLang(langSelect.value as Lang);
  langSelect.blur();
});
onLangChange(() => {
  langSelect.value = getLang();
  renderText();
});

let stage: Stage3D | null = null;
try {
  stage = new Stage3D($<HTMLCanvasElement>('gl'), $('stage'));
} catch {
  webglFailed = true;
}
renderText();

if (stage) {
  const s = stage;
  const game = new Game(s);
  bindKeyboard(game.input);
  bindTouch(game.input, $('stage'));

  // temporary debug bar (replaced by the real HUD and menus later)
  const reload = (): void => {
    const level = Math.max(1, Math.min(99, Math.floor(Number($<HTMLInputElement>('level').value)) || 1));
    const code = $<HTMLInputElement>('code').value.trim().toUpperCase();
    game.loadLevel({
      level,
      challengeSeed: code ? fnv1a(code) : 0,
      bonus: $<HTMLInputElement>('bonus').checked
    });
  };
  for (const id of ['level', 'code', 'bonus']) $(id).addEventListener('input', reload);
  $('bonus').addEventListener('change', (e) => (e.target as HTMLElement).blur());
  viewSelect.addEventListener('change', () => {
    view = viewSelect.value as ViewMode;
    s.rig.setView(view);
    viewSelect.blur();
  });
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
  game.start();
}
