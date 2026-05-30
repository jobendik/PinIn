import * as THREE from 'three';
import type { Poolable } from '@/core/ObjectPool';
import { Vec2 } from '@/math/Vec2';
import { neonMaterial, glowMaterial } from '@/rendering/materials';

const DOT_GEO = new THREE.SphereGeometry(0.55, 12, 12);
const GLOW_GEO = new THREE.SphereGeometry(0.85, 12, 12);

/**
 * An Extra Time Dot — a static sensor that grants time on overlap (+1s base,
 * +2s under Time Doubler). Once collected its sensor is disabled to prevent
 * double-counting, but the entity remains pooled so a player who backtracks
 * through a sector can re-collect it (blueprint §Temporal Economy / Time Doubler).
 */
export class DotEntity implements Poolable {
  readonly position = new Vec2();
  readonly radius = 1.2; // sensor radius (ball radius + visual)
  collected = false;
  active = false;

  readonly group: THREE.Group;
  private readonly core: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  private spin = 0;

  constructor(scene: THREE.Object3D) {
    this.group = new THREE.Group();
    this.core = new THREE.Mesh(DOT_GEO, neonMaterial(0xffffff, 1.7));
    this.glow = new THREE.Mesh(GLOW_GEO, glowMaterial(0xffffff, 0.16));
    this.group.add(this.core, this.glow);
    this.group.visible = false;
    scene.add(this.group);
  }

  configure(x: number, y: number, color: number): void {
    this.position.set(x, y);
    this.group.position.set(x, y, 1.0); // float above the floor
    this.core.material = neonMaterial(0xffffff, 1.7);
    (this.glow.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.collected = false;
    this.setVisible(true);
  }

  /** Mark as collected: hide and disable the sensor (respawnable on recycle). */
  collect(): void {
    this.collected = true;
    this.setVisible(false);
  }

  /** Cheap idle animation (variable-step, not part of the deterministic sim). */
  animate(dt: number): void {
    if (!this.active || this.collected) return;
    this.spin += dt * 2;
    this.group.rotation.y = this.spin;
    const pulse = 1 + Math.sin(this.spin * 2) * 0.12;
    this.glow.scale.setScalar(pulse);
  }

  private setVisible(v: boolean): void {
    this.group.visible = v;
  }

  reset(): void {
    this.active = true;
    this.collected = false;
  }

  recycle(): void {
    this.active = false;
    this.group.visible = false;
  }
}
