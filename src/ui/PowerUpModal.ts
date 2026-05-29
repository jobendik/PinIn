import type { PowerUpDef } from '@/powerups/types';

/**
 * The binary power-up chooser (blueprint §Power-Up Mechanics): when the ball
 * touches an orb the run pauses and two random power-ups are offered. Picking
 * one resolves a promise the Game awaits before resuming the simulation.
 */
export class PowerUpModal {
  private readonly root: HTMLElement;
  private readonly choicesEl: HTMLElement;
  private resolver: ((id: string) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'powerup-modal powerup-modal--hidden';
    this.root.innerHTML = `
      <div class="powerup-modal__prompt">Choose a Power-Up</div>
      <div class="powerup-modal__choices" id="powerup-choices"></div>
    `;
    parent.appendChild(this.root);
    this.choicesEl = this.root.querySelector('#powerup-choices')!;
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('powerup-modal--hidden');
  }

  /** Present two choices; resolves with the chosen power-up id. */
  present(a: PowerUpDef, b: PowerUpDef): Promise<string> {
    this.choicesEl.innerHTML = '';
    for (const def of [a, b]) {
      const card = document.createElement('div');
      card.className = 'powerup-card';
      card.innerHTML = `
        <div class="powerup-card__icon">${def.icon}</div>
        <div class="powerup-card__name">${def.name}</div>
        <div class="powerup-card__desc">${def.description}</div>
      `;
      card.addEventListener('click', () => this.choose(def.id));
      this.choicesEl.appendChild(card);
    }
    this.root.classList.remove('powerup-modal--hidden');
    return new Promise<string>((resolve) => {
      this.resolver = resolve;
    });
  }

  private choose(id: string): void {
    this.root.classList.add('powerup-modal--hidden');
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(id);
  }
}
