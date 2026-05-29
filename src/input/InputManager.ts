/**
 * Touch / pointer input (blueprint §Input Processing).
 *
 * The control scheme is split down the middle: a press on the left half of the
 * screen actuates every left flipper, the right half every right flipper, held
 * as a maintained switch (the flipper stays up while touched). Pointer Events
 * unify mouse and multi-touch so two fingers can hold both flippers at once.
 *
 * When the Push power-up is active the same gestures become swipes: the drag
 * vector is normalised and forwarded as a direct impulse on the ball.
 */
export interface InputHandlers {
  onFlipper(side: 'left' | 'right', down: boolean): void;
  /** Push mode: a normalised swipe direction with magnitude in [0,1]. */
  onSwipe(dx: number, dy: number, strength: number): void;
  isPushMode(): boolean;
}

interface ActivePointer {
  side: 'left' | 'right';
  startX: number;
  startY: number;
}

export class InputManager {
  private readonly pointers = new Map<number, ActivePointer>();
  private readonly leftPointers = new Set<number>();
  private readonly rightPointers = new Set<number>();
  private enabled = false;

  constructor(
    private readonly target: HTMLElement,
    private readonly handlers: InputHandlers,
  ) {}

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.target.addEventListener('pointerdown', this.onDown);
    this.target.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.target.removeEventListener('pointerdown', this.onDown);
    this.target.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.releaseAll();
  }

  /** Release any held flippers (used on pause / state changes). */
  releaseAll(): void {
    if (this.leftPointers.size) this.handlers.onFlipper('left', false);
    if (this.rightPointers.size) this.handlers.onFlipper('right', false);
    this.pointers.clear();
    this.leftPointers.clear();
    this.rightPointers.clear();
  }

  private readonly onDown = (e: PointerEvent): void => {
    const side: 'left' | 'right' = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
    this.pointers.set(e.pointerId, { side, startX: e.clientX, startY: e.clientY });

    if (this.handlers.isPushMode()) return; // Push uses swipes, not flippers.

    const set = side === 'left' ? this.leftPointers : this.rightPointers;
    const wasEmpty = set.size === 0;
    set.add(e.pointerId);
    if (wasEmpty) this.handlers.onFlipper(side, true);
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (!this.handlers.isPushMode()) return;
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.startX;
    const dy = p.startY - e.clientY; // screen Y is inverted vs world Y
    const len = Math.hypot(dx, dy);
    if (len < 8) return;
    const strength = Math.min(len / 160, 1);
    this.handlers.onSwipe(dx / len, dy / len, strength);
    // Reset origin so a continued drag keeps pushing in the new direction.
    p.startX = e.clientX;
    p.startY = e.clientY;
  };

  private readonly onUp = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    const set = p.side === 'left' ? this.leftPointers : this.rightPointers;
    if (set.delete(e.pointerId) && set.size === 0) {
      this.handlers.onFlipper(p.side, false);
    }
  };
}
