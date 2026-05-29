/**
 * A minimal stack-free finite state machine.
 *
 * Game flow (Menu → Playing → GameOver → Menu) and transient overrides such as
 * the power-up selection pause are modelled as discrete states so update/input
 * logic never has to branch on a tangle of booleans.
 */
export interface State<Ctx> {
  readonly name: string;
  onEnter?(ctx: Ctx, from: string | null): void;
  onExit?(ctx: Ctx, to: string): void;
  /** Fixed-step update; only the active state ticks. */
  fixedUpdate?(ctx: Ctx, dt: number): void;
  /** Variable-step update. */
  update?(ctx: Ctx, dt: number): void;
}

export class StateMachine<Ctx> {
  private current: State<Ctx> | null = null;
  private readonly states = new Map<string, State<Ctx>>();

  constructor(private readonly ctx: Ctx) {}

  register(state: State<Ctx>): this {
    this.states.set(state.name, state);
    return this;
  }

  get currentName(): string | null {
    return this.current?.name ?? null;
  }

  is(name: string): boolean {
    return this.current?.name === name;
  }

  transition(name: string): void {
    const next = this.states.get(name);
    if (!next || next === this.current) return;
    const from = this.current?.name ?? null;
    this.current?.onExit?.(this.ctx, name);
    this.current = next;
    next.onEnter?.(this.ctx, from);
  }

  fixedUpdate(dt: number): void {
    this.current?.fixedUpdate?.(this.ctx, dt);
  }

  update(dt: number): void {
    this.current?.update?.(this.ctx, dt);
  }
}
