import { describe, expect, it } from 'vitest';
import { DIRS } from '../src/config/constants';
import { PlayerInput } from '../src/input/playerInput';

describe('PlayerInput', () => {
  it('uses the most recently pressed key', () => {
    const i = new PlayerInput();
    i.press('up');
    i.press('left');
    i.update(0.016);
    expect(i.want).toBe(DIRS.left);
  });

  it('falls back to the previous held key on release', () => {
    const i = new PlayerInput();
    i.press('up');
    i.press('left');
    i.release('left');
    expect(i.want).toBe(DIRS.up);
  });

  it('remembers a tap briefly so the car turns at the next junction', () => {
    const i = new PlayerInput();
    i.press('right');
    i.release('right');
    i.update(0.3);
    expect(i.want).toBe(DIRS.right);
    i.update(0.2);
    expect(i.want).toBeNull();
  });

  it('keeps a held key alive indefinitely', () => {
    const i = new PlayerInput();
    i.press('down');
    for (let n = 0; n < 100; n++) i.update(0.1);
    expect(i.want).toBe(DIRS.down);
  });

  it('swipes expire after a longer buffer', () => {
    const i = new PlayerInput();
    i.swipe('up');
    i.update(0.6);
    expect(i.want).toBe(DIRS.up);
    i.update(0.2);
    expect(i.want).toBeNull();
  });

  it('reports the exhaust button while held', () => {
    const i = new PlayerInput();
    expect(i.takeSmoke()).toBe(false);
    i.setSmoke(true);
    expect(i.takeSmoke()).toBe(true);
    expect(i.takeSmoke()).toBe(true);
    i.setSmoke(false);
    expect(i.takeSmoke()).toBe(false);
  });

  it('a tap shorter than a simulation step still counts once', () => {
    const i = new PlayerInput();
    i.setSmoke(true);
    i.setSmoke(false);
    expect(i.takeSmoke()).toBe(true);
    expect(i.takeSmoke()).toBe(false);
  });

  it('clear forgets held keys and the exhaust button', () => {
    const i = new PlayerInput();
    i.setSmoke(true);
    i.clear();
    expect(i.takeSmoke()).toBe(false);
  });

  it('clear forgets held keys', () => {
    const i = new PlayerInput();
    i.press('up');
    i.clear();
    i.update(0.016);
    expect(i.want).toBeNull();
  });
});
