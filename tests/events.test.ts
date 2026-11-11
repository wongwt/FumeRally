import { describe, expect, it, vi } from 'vitest';
import { Emitter } from '../src/core/events';

interface E {
  ping: { n: number };
  pong: string;
}

describe('Emitter', () => {
  it('delivers payloads to subscribers of that event only', () => {
    const em = new Emitter<E>();
    const ping = vi.fn();
    const pong = vi.fn();
    em.on('ping', ping);
    em.on('pong', pong);
    em.emit('ping', { n: 1 });
    expect(ping).toHaveBeenCalledWith({ n: 1 });
    expect(pong).not.toHaveBeenCalled();
  });

  it('supports several listeners and unsubscribing', () => {
    const em = new Emitter<E>();
    const a = vi.fn();
    const b = vi.fn();
    const off = em.on('pong', a);
    em.on('pong', b);
    em.emit('pong', 'x');
    off();
    em.emit('pong', 'y');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('is fine to emit with no listeners', () => {
    expect(() => new Emitter<E>().emit('pong', 'x')).not.toThrow();
  });
});
