import * as THREE from 'three';
import { Flipper } from '@/physics/Flipper';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { Config } from '@/config/GameConfig';
import { FlipperEntity } from './FlipperEntity';

/**
 * A left/right flipper pair placed at one point on the table.
 *
 * The blueprint's control scheme actuates *all* left-facing flippers (or all
 * right-facing) on the active board at once, so the input manager simply
 * presses every active pair. Pairs are pooled and repositioned up the canyon by
 * the level streamer as the player climbs.
 */
export class FlipperPair {
  readonly left: Flipper;
  readonly right: Flipper;
  private readonly leftVis: FlipperEntity;
  private readonly rightVis: FlipperEntity;
  active = false;

  constructor(scene: THREE.Scene, world: PhysicsWorld) {
    this.left = new Flipper('left', 0, 0);
    this.right = new Flipper('right', 0, 0);
    world.addFlipper(this.left);
    world.addFlipper(this.right);
    this.leftVis = new FlipperEntity(scene, this.left, 0x14e0ff);
    this.rightVis = new FlipperEntity(scene, this.right, 0x14e0ff);
    this.deactivate();
  }

  /** Position the pair with the given gap between pivots, centred on `centerX`. */
  place(centerX: number, y: number, gap: number, color: number): void {
    this.left.setPivot(centerX - gap * 0.5, y);
    this.right.setPivot(centerX + gap * 0.5, y);
    this.left.active = true;
    this.right.active = true;
    this.active = true;
    this.leftVis.setColor(color);
    this.rightVis.setColor(color);
    this.leftVis.mesh.visible = true;
    this.rightVis.mesh.visible = true;
  }

  press(side: 'left' | 'right', down: boolean): void {
    if (!this.active) return;
    (side === 'left' ? this.left : this.right).press(down);
  }

  deactivate(): void {
    this.active = false;
    this.left.active = false;
    this.right.active = false;
    this.left.press(false);
    this.right.press(false);
    this.leftVis.mesh.visible = false;
    this.rightVis.mesh.visible = false;
  }

  sync(): void {
    if (!this.active) return;
    this.leftVis.sync();
    this.rightVis.sync();
  }

  get gapDefault(): number {
    return Config.flipper.length * 0.9;
  }
}
