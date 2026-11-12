export type SideTab = 'car' | 'challenge' | 'board';
const TABS: readonly SideTab[] = ['car', 'challenge', 'board'];

/**
 * The tabbed menu beside the stage (garage / challenge / leaderboard). It is only shown on the title
 * and game-over screens. On phones the tabs float at the top of the stage and a tab opens the panel
 * as a sheet over it (`sheetClass` on the play area); a second tap on the open tab closes it again.
 */
export class SideTabs {
  private readonly buttons: Map<SideTab, HTMLButtonElement>;
  private readonly panes: Map<SideTab, HTMLElement>;
  private current: SideTab = 'car';

  constructor(
    private readonly play: HTMLElement,
    root: HTMLElement,
    private readonly sheetClass = 'sheet'
  ) {
    this.buttons = new Map(TABS.map((id) => [id, root.querySelector<HTMLButtonElement>(`#tab-${id}`)!]));
    this.panes = new Map(TABS.map((id) => [id, root.querySelector<HTMLElement>(`#pane-${id}`)!]));
    for (const [id, b] of this.buttons) {
      b.addEventListener('click', () => {
        if (this.sheetOpen && this.current === id) this.closeSheet();
        else this.open(id);
        b.blur();
      });
      b.addEventListener('keydown', (e) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = TABS[(TABS.indexOf(id) + step + TABS.length) % TABS.length] as SideTab;
        this.select(next);
        this.buttons.get(next)?.focus();
      });
    }
    this.select('car');
  }

  get sheetOpen(): boolean {
    return this.play.classList.contains(this.sheetClass);
  }

  /** Shows a tab's pane (on phones the sheet stays as it is). */
  select(tab: SideTab): void {
    this.current = tab;
    for (const id of TABS) {
      const on = id === tab;
      const b = this.buttons.get(id) as HTMLButtonElement;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      (this.panes.get(id) as HTMLElement).hidden = !on;
    }
  }

  /** Selects a tab and, on phones, opens the sheet. */
  open(tab: SideTab): void {
    this.select(tab);
    this.play.classList.add(this.sheetClass);
  }

  closeSheet(): void {
    this.play.classList.remove(this.sheetClass);
  }
}
