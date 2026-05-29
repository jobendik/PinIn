import { bus } from '@/core/EventBus';
import { Config } from '@/config/GameConfig';
import { POWERUP_BY_ID } from '@/powerups/definitions';

/**
 * The Heads-Up Display (blueprint §UX): an intentionally minimal overlay — a big
 * top-centre countdown and the current distance/rank. It lives in plain DOM
 * layered above the WebGL canvas so the bloom and tone-mapping never blur the
 * readable UI. Driven entirely by EventBus events; it holds no game state.
 */
export class HUD {
  private readonly root: HTMLElement;
  private readonly timerEl: HTMLElement;
  private readonly distanceEl: HTMLElement;
  private readonly rankEl: HTMLElement;
  private readonly powerupEl: HTMLElement;
  private readonly unbinders: Array<() => void> = [];

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud__timer" id="hud-timer">60.0</div>
      <div class="hud__distance" id="hud-distance">0 m</div>
      <div class="hud__rank" id="hud-rank">Rookie</div>
      <div class="hud__powerup" id="hud-powerup"></div>
    `;
    parent.appendChild(this.root);

    this.timerEl = this.root.querySelector('#hud-timer')!;
    this.distanceEl = this.root.querySelector('#hud-distance')!;
    this.rankEl = this.root.querySelector('#hud-rank')!;
    this.powerupEl = this.root.querySelector('#hud-powerup')!;

    this.bind();
  }

  show(): void {
    this.root.style.display = 'block';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  private bind(): void {
    this.unbinders.push(
      bus.on('time:changed', ({ remaining }) => {
        this.timerEl.textContent = remaining.toFixed(1);
        this.timerEl.classList.toggle(
          'hud__timer--danger',
          remaining <= Config.time.dangerThreshold,
        );
      }),
      bus.on('distance:changed', ({ distance, rank }) => {
        this.distanceEl.textContent = `${distance.toLocaleString()} m`;
        this.rankEl.textContent = rank;
      }),
      bus.on('powerup:activated', () => this.refreshPowerup()),
      bus.on('powerup:expired', () => this.refreshPowerup()),
    );
  }

  /** The Game pushes the active power-up id set so the badge stays in sync. */
  setActivePowerups(ids: string[]): void {
    if (ids.length === 0) {
      this.powerupEl.classList.remove('hud__powerup--active');
      this.powerupEl.textContent = '';
      return;
    }
    const labels = ids
      .map((id) => {
        const def = POWERUP_BY_ID.get(id);
        return def ? `${def.icon} ${def.name}` : id;
      })
      .join('   ');
    this.powerupEl.textContent = labels;
    this.powerupEl.classList.add('hud__powerup--active');
  }

  private refreshPowerup(): void {
    // Actual ids are pushed by the Game each frame; this just nudges visibility.
  }

  dispose(): void {
    for (const off of this.unbinders) off();
    this.root.remove();
  }
}
