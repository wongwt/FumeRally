// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { PlayerInput } from '../src/input/playerInput';
import { bindTouch } from '../src/input/touch';
import { Modal } from '../src/ui/modal';

const fire = (el: Element, type: string, init: Record<string, unknown> = {}): Event => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 0, clientY: 0, ...init });
  Object.defineProperty(e, 'pointerType', { value: (init.pointerType as string) ?? 'touch' });
  el.dispatchEvent(e);
  return e;
};

describe('Modal', () => {
  let host: HTMLElement;
  let modal: Modal;
  let before: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = '<button id="before">before</button><div id="modal" hidden></div>';
    host = document.getElementById('modal') as HTMLElement;
    before = document.getElementById('before') as HTMLButtonElement;
    modal = new Modal(host);
  });

  const html = '<div><button data-close="1" id="a">A</button><button id="b">B</button></div>';

  it('opens, moves focus into the dialog and remembers where it came from', () => {
    before.focus();
    modal.show(html);
    expect(modal.isOpen).toBe(true);
    expect(host.hidden).toBe(false);
    expect(document.activeElement?.id).toBe('a');
  });

  it('gives focus back when it closes, and reports it', () => {
    const onClose = vi.fn();
    modal.onClose = onClose;
    before.focus();
    modal.show(html);
    modal.close();
    expect(host.hidden).toBe(true);
    expect(document.activeElement).toBe(before);
    expect(onClose).toHaveBeenCalledTimes(1);
    modal.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the dialog, in both directions', () => {
    modal.show(html);
    const tab = (shiftKey = false): void => {
      host.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
      );
    };
    tab();
    expect(document.activeElement?.id).toBe('b');
    tab();
    expect(document.activeElement?.id).toBe('a');
    tab(true);
    expect(document.activeElement?.id).toBe('b');
  });

  it('closes from a [data-close] button or a click on the backdrop, but not on the card', () => {
    modal.show('<div class="card"><button data-close="1">x</button><p id="text">hi</p></div>');
    (document.getElementById('text') as HTMLElement).click();
    expect(modal.isOpen).toBe(true);
    (host.querySelector('button') as HTMLButtonElement).click();
    expect(modal.isOpen).toBe(false);
    modal.show('<p>no buttons</p>');
    expect(document.activeElement).toBe(host); // nothing to focus: the dialog itself takes focus
    host.click();
    expect(modal.isOpen).toBe(false);
  });

  it('does not let presses inside the dialog reach the stage underneath', () => {
    const stageSpy = vi.fn();
    document.body.addEventListener('pointerdown', stageSpy);
    modal.show(html);
    (document.getElementById('b') as HTMLElement).dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(stageSpy).not.toHaveBeenCalled();
  });
});

describe('bindTouch', () => {
  let stage: HTMLElement;
  let input: PlayerInput;
  type Step = (delta: 1 | -1) => void;
  let onTap: () => void;
  let menu: { active: Mock<() => boolean>; step: Mock<Step>; cycle: Mock<Step> };

  beforeEach(() => {
    document.body.innerHTML = `
      <main id="stage" tabindex="0">
        <div class="touch">
          <button class="pad up" data-dir="up"></button>
          <button class="pad left" data-dir="left"></button>
          <button class="smoke" data-smoke></button>
        </div>
      </main>`;
    stage = document.getElementById('stage') as HTMLElement;
    input = new PlayerInput();
    onTap = vi.fn();
    menu = { active: vi.fn<() => boolean>(() => false), step: vi.fn<Step>(), cycle: vi.fn<Step>() };
    bindTouch(input, stage, onTap, menu);
  });

  it('a d-pad button steers and releases, without counting as a tap on the stage', () => {
    const up = stage.querySelector('.pad.up') as HTMLElement;
    fire(up, 'pointerdown');
    input.update(0.016);
    expect(input.want).toEqual({ x: 0, y: -1 });
    expect(up.classList.contains('active')).toBe(true);
    fire(up, 'pointerup');
    expect(up.classList.contains('active')).toBe(false);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('the smoke button works the same way', () => {
    const smoke = stage.querySelector('.smoke') as HTMLElement;
    fire(smoke, 'pointerdown');
    expect(input.takeSmoke()).toBe(true);
    fire(smoke, 'pointerup');
    expect(input.takeSmoke()).toBe(false);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('a tap on the stage itself is reported', () => {
    fire(stage, 'pointerdown');
    fire(stage, 'pointerup');
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('a swipe during play steers and is not a tap', () => {
    fire(stage, 'pointerdown', { clientX: 100, clientY: 100 });
    fire(stage, 'pointermove', { clientX: 100, clientY: 40 });
    input.update(0.016);
    expect(input.want).toEqual({ x: 0, y: -1 });
    fire(stage, 'pointerup');
    expect(onTap).not.toHaveBeenCalled();
  });

  it('on the menu, vertical swipes step the stage and horizontal ones cycle the car', () => {
    menu.active.mockReturnValue(true);
    fire(stage, 'pointerdown', { clientX: 100, clientY: 100 });
    fire(stage, 'pointermove', { clientX: 100, clientY: 60 });
    expect(menu.step).toHaveBeenCalledWith(1);
    fire(stage, 'pointermove', { clientX: 150, clientY: 60 });
    expect(menu.cycle).toHaveBeenCalledWith(1);
    fire(stage, 'pointermove', { clientX: 100, clientY: 100 });
    expect(menu.cycle).toHaveBeenCalledWith(-1);
    fire(stage, 'pointerup');
    expect(onTap).not.toHaveBeenCalled(); // it was a swipe, so it must not also start the game
  });

  it('a plain tap on the menu still starts', () => {
    menu.active.mockReturnValue(true);
    fire(stage, 'pointerdown', { clientX: 100, clientY: 100 });
    fire(stage, 'pointerup', { clientX: 100, clientY: 100 });
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('suppresses the long-press context menu on the stage and the buttons', () => {
    expect(fire(stage, 'contextmenu').defaultPrevented).toBe(true);
    expect(fire(stage.querySelector('.pad.up') as HTMLElement, 'contextmenu').defaultPrevented).toBe(true);
    expect(fire(stage.querySelector('.smoke') as HTMLElement, 'contextmenu').defaultPrevented).toBe(true);
  });
});
