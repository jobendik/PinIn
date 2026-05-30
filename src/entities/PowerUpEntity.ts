import * as THREE from 'three';
import type { Poolable } from '@/core/ObjectPool';
import { Vec2 } from '@/math/Vec2';
import { neonMaterial, glowMaterial } from '@/rendering/materials';

/** Build a flat 5-point star outline extruded into a thin solid. */
function makeStarGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const spikes = 5;
  const outer = 1.0;
  const inner = 0.45;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
  geo.center();
  return geo;
}

const STAR_GEO = makeStarGeometry();
const GLOW_GEO = new THREE.SphereGeometry(1.2, 16, 16);

/**
 * A power-up orb: a star-shaped sensor placed in a hard-to-reach spot. On
 * collision the game pauses and offers a binary choice of two power-ups
 * (blueprint §Power-Up Mechanics).
 */
export class PowerUpEntity implements Poolable {
  readonly position = new Vec2();
  readonly radius = 1.6;
  collected = false;
  active = false;

  readonly group: THREE.Group;
  private readonly star: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  private spin = 0;

  constructor(scene: THREE.Object3D) {
    this.group = new THREE.Group();
    this.star = new THREE.Mesh(STAR_GEO, neonMaterial(0xff2d95, 1.6));
    this.glow = new THREE.Mesh(GLOW_GEO, glowMaterial(0xff2d95, 0.2));
    this.group.add(this.star, this.glow);
    this.group.visible = false;
    scene.add(this.group);
  }

  configure(x: number, y: number, color: number): void {
    this.position.set(x, y);
    this.group.position.set(x, y, 1.3); // float above the floor
    this.star.material = neonMaterial(color, 1.6);
    (this.glow.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.collected = false;
    this.group.visible = true;
  }

  collect(): void {
    this.collected = true;
    this.group.visible = false;
  }

  animate(dt: number): void {
    if (!this.active || this.collected) return;
    this.spin += dt * 1.6;
    this.star.rotation.z = this.spin;
    const pulse = 1 + Math.sin(this.spin * 3) * 0.18;
    this.glow.scale.setScalar(pulse);
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
