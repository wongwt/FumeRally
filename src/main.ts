import { fnv1a } from './core/rng';
import { Game } from './game/game';
import { getLang, initLang, LANGS, onLangChange, setLang, t, type Lang, type MessageKey } from './i18n';
import { bindKeyboard } from './input/keyboard';
import { bindTouch } from './input/touch';
import { Stage3D } from './render/stage3d';
import { Banner } from './ui/banner';
import { Hud } from './ui/hud';
import { Popups } from './ui/popups';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const bannerEl = $('banner');
const btnPause = $<HTMLButtonElement>('btnPause');
const btnView = $<HTMLButtonElement>('btnView');
const btnLang = $<HTMLButtonElement>('btnLang');

let game: Game | null = null;
let webglFailed = false;

function renderText(): void {
  document.title = `${t('app.title')} ${t('app.subtitle')}`;
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n as MessageKey);
  }
  const other = LANGS.find((l) => l.id !== getLang());
  btnLang.textContent = other ? other.label : '';
  btnLang.setAttribute('aria-label', t('app.language'));
  btnView.textContent = t(game?.view === 'full' ? 'view.full' : 'view.scroll');
  btnPause.textContent = t(game?.sim.phase === 'paused' ? 'btn.resume' : 'btn.pause');
  if (webglFailed) {
    bannerEl.className = 'banner card';
    bannerEl.innerHTML = `<div class="panel"><h2>${t('error.webgl.title')}</h2><p class="lead">${t('error.webgl.body')}</p></div>`;
    bannerEl.hidden = false;
  }
  game?.refreshText();
}

initLang();
btnLang.addEventListener('click', () => {
  const other = LANGS.find((l) => l.id !== getLang());
  if (other) setLang(other.id as Lang);
  btnLang.blur();
});
onLangChange(renderText);

let stage: Stage3D | null = null;
try {
  stage = new Stage3D($<HTMLCanvasElement>('gl'), $('stage'));
} catch {
  webglFailed = true;
}

if (stage) {
  const s = stage;
  game = new Game(s, {
    hud: new Hud(),
    banner: new Banner(bannerEl),
    popups: new Popups($('stage'), (x, y) => s.rig.project(x, y)),
    onPhase: () => {
      btnPause.textContent = t(game?.sim.phase === 'paused' ? 'btn.resume' : 'btn.pause');
    }
  });
  const g = game;
  bindKeyboard(g.input, {
    confirm: () => g.confirm(),
    pause: () => g.togglePause(),
    toggleView: () => btnView.click()
  });
  bindTouch(g.input, $('stage'), () => void g.confirm());

  btnPause.addEventListener('click', () => {
    g.togglePause();
    btnPause.blur();
  });
  btnView.addEventListener('click', () => {
    g.setView(g.view === 'scroll' ? 'full' : 'scroll');
    btnView.textContent = t(g.view === 'full' ? 'view.full' : 'view.scroll');
    btnView.blur();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && g.sim.phase === 'play') g.togglePause();
  });

  if (import.meta.env.DEV) {
    // Developer panel: pick the starting level / level code without playing up to it.
    const panel = $('debug');
    panel.hidden = false;
    const apply = (): void => {
      const level = Math.max(1, Math.min(99, Math.floor(Number($<HTMLInputElement>('level').value)) || 1));
      const code = $<HTMLInputElement>('code').value.trim().toUpperCase();
      if (!g.sim.wantsStart) return;
      g.sim.startLevel = level;
      g.sim.challengeSeed = code ? fnv1a(code) : 0;
      g.sim.loadLevel(level, false);
    };
    for (const id of ['level', 'code']) $(id).addEventListener('input', apply);
    (window as unknown as { __game: Game }).__game = g;
  }
  g.start();
}
renderText();
