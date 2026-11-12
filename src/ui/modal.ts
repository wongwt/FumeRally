const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A full-stage dialog (new car, achievements). Click the backdrop or any `[data-close]` to close it.
 * Focus moves into the dialog (to `[data-autofocus]` if present, else the first control) while it is open, stays there (Tab cycles), and returns afterwards.
 */
export class Modal {
  private open = false;
  private previousFocus: HTMLElement | null = null;
  /** Called after the dialog closes, however it was closed. */
  onClose: (() => void) | undefined;

  constructor(private readonly el: HTMLElement) {
    // clicks inside the dialog must not reach the stage underneath (they would start/resume the game)
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target === el || target?.closest('[data-close]')) this.close();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !this.open) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      e.preventDefault();
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
      (items[next] as HTMLElement).focus();
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(html: string): void {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.el.innerHTML = html;
    this.el.hidden = false;
    this.open = true;
    const first =
      this.el.querySelector<HTMLElement>('[data-autofocus]') ?? this.el.querySelector<HTMLElement>(FOCUSABLE);
    if (first) {
      first.focus({ preventScroll: true });
    } else {
      this.el.tabIndex = -1;
      this.el.focus({ preventScroll: true });
    }
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.el.hidden = true;
    const back = this.previousFocus;
    this.previousFocus = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
    this.onClose?.();
  }
}
