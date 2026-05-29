/**
 * A fixed-capacity object pool.
 *
 * The blueprint is emphatic: never instantiate/destroy gameplay entities during
 * a run — pre-allocate a constant set on load, then deactivate + reposition +
 * reconfigure + reactivate as the camera scrolls. This keeps the memory
 * footprint flat and avoids GC stutter that would corrupt the fixed-step sim.
 */
export interface Poolable {
  /** Called when the object is handed out. */
  reset(): void;
  /** Called when the object is returned to the pool (hide / disable). */
  recycle(): void;
}

export class ObjectPool<T extends Poolable> {
  private readonly all: T[] = [];
  private readonly free: T[] = [];
  private readonly active = new Set<T>();

  constructor(factory: () => T, capacity: number) {
    for (let i = 0; i < capacity; i++) {
      const obj = factory();
      obj.recycle();
      this.all.push(obj);
      this.free.push(obj);
    }
  }

  /** Borrow an object, or `null` if the pool is exhausted (never grows). */
  acquire(): T | null {
    const obj = this.free.pop();
    if (!obj) return null;
    obj.reset();
    this.active.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (!this.active.delete(obj)) return;
    obj.recycle();
    this.free.push(obj);
  }

  releaseAll(): void {
    for (const obj of this.active) {
      obj.recycle();
      this.free.push(obj);
    }
    this.active.clear();
  }

  forEachActive(fn: (obj: T) => void): void {
    for (const obj of this.active) fn(obj);
  }

  get activeCount(): number {
    return this.active.size;
  }

  get capacity(): number {
    return this.all.length;
  }
}
