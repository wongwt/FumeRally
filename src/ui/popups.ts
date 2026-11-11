/** Floating "+100" style text over the stage. */
export class Popups {
  constructor(
    private readonly host: HTMLElement,
    /** Projects a tile position to normalised device coordinates (−1..1). */
    private readonly project: (x: number, y: number) => { x: number; y: number }
  ) {}

  show(text: string, tileX: number, tileY: number, color: string): void {
    const v = this.project(tileX, tileY);
    const el = document.createElement('div');
    el.className = 'popup';
    el.textContent = text;
    el.style.color = color;
    el.style.left = (v.x * 0.5 + 0.5) * this.host.clientWidth + 'px';
    el.style.top = (-v.y * 0.5 + 0.5) * this.host.clientHeight + 'px';
    this.host.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
}
