import { SaveManager } from '@/persistence/SaveManager';

/**
 * Full-screen overlays: the start menu and the game-over screen. Both are plain
 * DOM with neon styling. Callbacks let the Game drive state transitions without
 * the UI knowing anything about the simulation.
 */
export interface OverlayCallbacks {
  onStart(): void;
  onRestart(): void;
  onContinue(): void;
}

export class Overlays {
  private readonly menu: HTMLElement;
  private readonly gameOver: HTMLElement;
  private readonly goDistance: HTMLElement;
  private readonly goBest: HTMLElement;
  private readonly continueBtn: HTMLButtonElement;

  constructor(parent: HTMLElement, private readonly callbacks: OverlayCallbacks) {
    this.menu = document.createElement('div');
    this.menu.className = 'overlay';
    this.menu.innerHTML = `
      <div class="overlay__title">PININ</div>
      <div class="overlay__subtitle">
        Tap left &amp; right to flip. Collect time, cross checkpoints, climb forever.
      </div>
      <button class="btn" data-action="start">Start</button>
      <div class="overlay__subtitle" id="menu-best"></div>
    `;
    parent.appendChild(this.menu);

    this.gameOver = document.createElement('div');
    this.gameOver.className = 'overlay overlay--hidden';
    this.gameOver.innerHTML = `
      <div class="overlay__title">TIME OUT</div>
      <div class="overlay__stat">Distance <b id="go-distance">0</b> m</div>
      <div class="overlay__stat">Best <b id="go-best">0</b> m</div>
      <div style="display:flex; gap:16px; flex-wrap:wrap; justify-content:center;">
        <button class="btn btn--secondary overlay--hidden" data-action="continue" id="go-continue">
          Continue
        </button>
        <button class="btn" data-action="restart">Retry</button>
      </div>
    `;
    parent.appendChild(this.gameOver);

    this.goDistance = this.gameOver.querySelector('#go-distance')!;
    this.goBest = this.gameOver.querySelector('#go-best')!;
    this.continueBtn = this.gameOver.querySelector('#go-continue')!;

    this.menu.querySelector('[data-action="start"]')!.addEventListener('click', () => {
      this.hideMenu();
      this.callbacks.onStart();
    });
    this.gameOver.querySelector('[data-action="restart"]')!.addEventListener('click', () => {
      this.hideGameOver();
      this.callbacks.onRestart();
    });
    this.continueBtn.addEventListener('click', () => {
      this.hideGameOver();
      this.callbacks.onContinue();
    });

    this.refreshBest();
  }

  private refreshBest(): void {
    const best = SaveManager.getBest();
    const el = this.menu.querySelector('#menu-best');
    if (el) el.textContent = best > 0 ? `Best ${best.toLocaleString()} m` : '';
  }

  showMenu(): void {
    this.refreshBest();
    this.menu.classList.remove('overlay--hidden');
  }

  hideMenu(): void {
    this.menu.classList.add('overlay--hidden');
  }

  showGameOver(distance: number, best: number, canContinue: boolean): void {
    this.goDistance.textContent = distance.toLocaleString();
    this.goBest.textContent = best.toLocaleString();
    this.continueBtn.classList.toggle('overlay--hidden', !canContinue);
    this.gameOver.classList.remove('overlay--hidden');
    this.gameOver.classList.add('fade-in');
  }

  hideGameOver(): void {
    this.gameOver.classList.add('overlay--hidden');
    this.gameOver.classList.remove('fade-in');
  }
}
