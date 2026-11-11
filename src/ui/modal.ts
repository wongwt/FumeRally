/** A full-stage dialog (new car, achievements). Click the backdrop or any `[data-close]` to close it. */
export class Modal {
  private open = false;
  /** Called after the dialog closes, however it was closed. */
  onClose: (() => void) | undefined;

  constructor(private readonly el: HTMLElement) {
    // clicks inside the dialog must not reach the stage underneath (they would start/resume the game)
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target === el || target?.closest('[data-close]')) this.close();
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(html: string): void {
    this.el.innerHTML = html;
    this.el.hidden = false;
    this.open = true;
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.el.hidden = true;
    this.onClose?.();
  }
}
