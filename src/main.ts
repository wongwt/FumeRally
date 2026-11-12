import { AudioEngine } from './audio/engine';
import { loadMuted, saveMuted } from './audio/settings';
import { bindSfx, Sfx } from './audio/sfx';
import { carUnlocked } from './config/cars';
import { Game } from './game/game';
import { getLang, initLang, LANGS, onLangChange, setLang, t, type Lang, type MessageKey } from './i18n';
import { bindKeyboard } from './input/keyboard';
import { bindTouch } from './input/touch';
import { Stage3D } from './render/stage3d';
import { Hud } from './ui/hud';
import { Popups } from './ui/popups';
import { SideTabs } from './ui/sideTabs';
import { ChallengePanel } from './ui/challengePanel';
import { Garage } from './ui/garage';
import { Radar } from './ui/radar';
import { GhostStore } from './storage/ghosts';
import { Prefs } from './storage/prefs';
import { Records } from './storage/records';
import { browserStorage } from './storage/storage';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const bannerEl = $('banner');
const btnPause = $<HTMLButtonElement>('btnPause');
const btnView = $<HTMLButtonElement>('btnView');
const btnLang = $<HTMLButtonElement>('btnLang');
const btnMute = $<HTMLButtonElement>('btnMute');
const btnAch = $<HTMLButtonElement>('btnAch');

const storage = browserStorage();
const records = new Records(storage);
records.load();
const ghosts = new GhostStore(storage);
ghosts.load();
const prefs = new Prefs(storage);
prefs.load();

const audio = new AudioEngine();
audio.muted = loadMuted();
const sfx = new Sfx(audio);

let game: Game | null = null;
let webglFailed = false;
let contextLost = false;

function renderText(): void {
  document.title = t('app.docTitle');
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n as MessageKey);
  }
  const other = LANGS.find((l) => l.id !== getLang());
  // The button shows the other language's own name ("English"), so that text is its accessible name;
  // `lang` makes screen readers pronounce it in that language.
  btnLang.textContent = other ? other.label : '';
  if (other) btnLang.lang = other.id;
  btnLang.title = t('app.language');
  btnView.textContent = t(game?.view === 'full' ? 'view.full' : 'view.scroll');
  btnPause.textContent = t(game?.sim.phase === 'paused' ? 'btn.resume' : 'btn.pause');
  btnMute.textContent = t(audio.muted ? 'btn.unmute' : 'btn.mute');
  btnMute.setAttribute('aria-pressed', String(audio.muted));
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel as MessageKey));
  }
  game?.refreshText();
  // error messages go last so the game's own screens do not paint over them
  if (webglFailed || contextLost) {
    const kind = webglFailed ? 'webgl' : 'contextLost';
    bannerEl.className = 'banner card';
    bannerEl.innerHTML = `<div class="panel"><h2>${t(`error.${kind}.title`)}</h2><p class="lead">${t(`error.${kind}.body`)}</p></div>`;
    bannerEl.hidden = false;
  }
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
  const playEl = $('play');
  const tabs = new SideTabs(playEl, $('challenge'));
  const panel = new ChallengePanel({
    onMode: (mode) => game?.selectMode(mode),
    onCode: (raw) => game?.typeCode(raw),
    onRandom: () => game?.randomCode(),
    onGhost: (on) => game?.setGhost(on),
    onStart: () => game?.begin()
  });
  game = new Game(
    s,
    {
      hud: new Hud(),
      bannerEl,
      popups: new Popups($('stage'), (x, y) => s.rig.project(x, y)),
      radar: new Radar($<HTMLCanvasElement>('radar')),
      panel,
      garage: new Garage($('cars'), (id) => game?.selectCar(id)),
      modalEl: $('modal'),
      achToastEl: $('achToast'),
      onAchChange: ({ count, total }) => {
        btnAch.textContent = t('btn.achievements', { n: count, total });
      },
      onUnlockShown: () => sfx.clear(),
      onPhase: (sim) => {
        btnPause.textContent = t(sim.phase === 'paused' ? 'btn.resume' : 'btn.pause');
        playEl.classList.toggle('menu', sim.wantsStart); // touch pad only while a game is on
        if (!sim.wantsStart) tabs.closeSheet(); // close the phone menu sheet once a game starts
      },
      onInvalidStart: () => {
        tabs.open('challenge');
        panel.focusCode();
      }
    },
    { records, ghosts, prefs }
  );
  const g = game;
  g.setView(prefs.view);
  playEl.classList.toggle('scroll', g.view === 'scroll');
  g.init();

  // The browser may take the GPU away (memory pressure, driver reset): pause, say so, and carry on when it returns.
  s.element.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    contextLost = true;
    if (g.sim.phase === 'play' || g.sim.phase === 'ready') g.togglePause();
    renderText();
  });
  s.element.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    renderText();
  });
  bindKeyboard(g.input, {
    confirm: () => g.confirm(),
    pause: () => g.togglePause(),
    toggleView: () => btnView.click(),
    toggleMute: () => btnMute.click(),
    menuDir: (dir) => g.menuDir(dir),
    modalOpen: () => g.modal.isOpen,
    closeModal: () => g.modal.close()
  });
  bindSfx(g.sim.events, sfx);
  bindTouch(g.input, $('stage'), () => void g.confirm(), {
    active: () => g.sim.wantsStart,
    step: (d) => g.changeStartLevel(d),
    cycle: (d) => g.cycleCar(d)
  });

  // Browsers only allow audio after a user gesture, so (re)start it on every press, before other handlers run.
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => audio.ensure(), true);
  btnMute.addEventListener('click', () => {
    audio.ensure();
    audio.muted = !audio.muted;
    saveMuted(audio.muted);
    renderText();
    btnMute.blur();
  });
  btnPause.addEventListener('click', () => {
    g.togglePause();
    btnPause.blur();
  });
  btnView.addEventListener('click', () => {
    g.setView(g.view === 'scroll' ? 'full' : 'scroll');
    playEl.classList.toggle('scroll', g.view === 'scroll');
    prefs.view = g.view;
    prefs.saveView();
    btnView.textContent = t(g.view === 'full' ? 'view.full' : 'view.scroll');
    btnView.blur();
  });
  btnAch.addEventListener('click', () => {
    audio.ensure();
    g.openAchievements();
    btnAch.blur();
  });
  window.addEventListener('pagehide', () => records.save());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && g.sim.phase === 'play') g.togglePause();
  });

  if (import.meta.env.DEV) {
    // Developer panel: jump to any starting stage without playing up to it.
    $('debug').hidden = false;
    $('devLevel').addEventListener('input', () => {
      const level = Math.max(1, Math.min(99, Math.floor(Number($<HTMLInputElement>('devLevel').value)) || 1));
      if (!g.sim.wantsStart) return;
      g.sim.startLevel = level;
      g.sim.loadLevel(level, false);
      g.refreshScreens();
    });
    $('devCarLv').addEventListener('input', () => {
      records.data.carLv = Math.max(0, Math.floor(Number($<HTMLInputElement>('devCarLv').value)) || 0);
      records.save();
      if (!carUnlocked(g.sim.carId, records.data.carLv)) g.selectCar('sedan');
      g.refreshScreens();
    });
    (window as unknown as { __game: Game }).__game = g;
  }
  g.start();
}
renderText();
