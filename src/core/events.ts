type Handlers<E> = { [K in keyof E]?: Set<(payload: E[K]) => void> };

/** Tiny typed event emitter: the simulation announces what happened, presenters react. */
export class Emitter<E> {
  private readonly handlers: Handlers<E> = {};

  /** Subscribes; returns an unsubscribe function. */
  on<K extends keyof E>(name: K, fn: (payload: E[K]) => void): () => void {
    const set = (this.handlers[name] ??= new Set());
    set.add(fn);
    return () => set.delete(fn);
  }

  emit<K extends keyof E>(name: K, payload: E[K]): void {
    this.handlers[name]?.forEach((fn) => fn(payload));
  }
}
