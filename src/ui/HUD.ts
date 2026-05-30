import { bus } from '@/core/EventBus';
import { Config } from '@/config/GameConfig';
import { POWERUP_BY_ID } from '@/powerups/definitions';

/**
 * The Heads-Up Display (blueprint §UX / reference shots): a big split top-centre
 * countdown (large seconds + small tenths), the rank, and — at the bottom — the
 * distance counter and a checkpoint progress bar tracking the 0→1000 climb to
 * the next checkpoint. Crossing one flashes an "EXTRA TIME" banner.
 *
 * Plain DOM layered above the WebGL canvas so bloom/tone-mapping never blur it.
 * Driven entirely by EventBus events; holds no game state.
 */
export class HUD {
  private readonly root: HTMLElement;
  private readonly timerBig: HTMLElement;
  private readonly timerDec: HTMLElement;
  private readonly timerWrap: HTMLElement;
  private readonly rankEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly powerupEl: HTMLElement;
  private readonly distanceEl: HTMLElement;
  private readonly fillEl: HTMLElement;
  private readonly cpFromEl: HTMLElement;
  private readonly cpToEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private bannerTimer = 0;
  private readonly unbinders: Array<() => void> = [];

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud__timer" id="hud-timer">
        <span class="hud__timer-big" id="hud-timer-big">60</span><span class="hud__timer-dec" id="hud-timer-dec">0</span>
      </div>
      <div class="hud__rank" id="hud-rank">Rookie</div>
      <div class="hud__banner" id="hud-banner"></div>
      <div class="hud__hint" id="hud-hint">Tap to launch</div>
      <div class="hud__powerup" id="hud-powerup"></div>
      <div class="hud__bottom">
        <div class="hud__distance" id="hud-distance">0</div>
        <div class="hud__progress">
          <span class="hud__cp" id="hud-cp-from">0</span>
          <div class="hud__progress-track"><div class="hud__progress-fill" id="hud-fill"></div></div>
          <span class="hud__cp" id="hud-cp-to">1</span>
        </div>
      </div>
    `;
    parent.appendChild(this.root);

    this.timerWrap = this.root.querySelector('#hud-timer')!;
    this.timerBig = this.root.querySelector('#hud-timer-big')!;
    this.timerDec = this.root.querySelector('#hud-timer-dec')!;
    this.rankEl = this.root.querySelector('#hud-rank')!;
    this.hintEl = this.root.querySelector('#hud-hint')!;
    this.powerupEl = this.root.querySelector('#hud-powerup')!;
    this.distanceEl = this.root.querySelector('#hud-distance')!;
    this.fillEl = this.root.querySelector('#hud-fill')!;
    this.cpFromEl = this.root.querySelector('#hud-cp-from')!;
    this.cpToEl = this.root.querySelector('#hud-cp-to')!;
    this.bannerEl = this.root.querySelector('#hud-banner')!;

    this.bind();
  }

  show(): void {
    this.root.style.display = 'block';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  setHint(text: string | null): void {
    if (text) {
      this.hintEl.textContent = text;
      this.hintEl.classList.add('hud__hint--active');
    } else {
      this.hintEl.classList.remove('hud__hint--active');
    }
  }

  /** Tick the EXTRA TIME banner fade (called each render frame). */
  update(dt: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.classList.remove('hud__banner--active');
    }
  }

  private bind(): void {
    this.unbinders.push(
      bus.on('time:changed', ({ remaining }) => {
        const r = Math.max(0, remaining);
        this.timerBig.textContent = String(Math.floor(r));
        this.timerDec.textContent = String(Math.floor((r - Math.floor(r)) * 10));
        this.timerWrap.classList.toggle('hud__timer--danger', r <= Config.time.dangerThreshold);
      }),
      bus.on('distance:changed', ({ distance, rank }) => {
        this.distanceEl.textContent = distance.toLocaleString();
        this.rankEl.textContent = rank;
        const from = Math.floor(distance / 1000) * 1000;
        this.cpFromEl.textContent = String(Math.floor(from / 1000));
        this.cpToEl.textContent = String(Math.floor(from / 1000) + 1);
        this.fillEl.style.width = `${((distance - from) / 1000) * 100}%`;
      }),
      bus.on('checkpoint:crossed', ({ bonus }) => {
        this.bannerEl.textContent = `Extra Time  +${bonus}`;
        this.bannerEl.classList.add('hud__banner--active');
        this.bannerTimer = 1.6;
      }),
    );
  }

  /** The Game pushes the active power-up id set so the badge stays in sync. */
  setActivePowerups(ids: string[]): void {
    if (ids.length === 0) {
      this.powerupEl.classList.remove('hud__powerup--active');
      this.powerupEl.textContent = '';
      return;
    }
    this.powerupEl.textContent = ids
      .map((id) => {
        const def = POWERUP_BY_ID.get(id);
        return def ? `${def.icon} ${def.name}` : id;
      })
      .join('   ');
    this.powerupEl.classList.add('hud__powerup--active');
  }

  dispose(): void {
    for (const off of this.unbinders) off();
    this.root.remove();
  }
}
