import * as THREE from 'three';
import type { Poolable } from '@/core/ObjectPool';
import { Segment } from '@/physics/Segment';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { neonMaterial, wallMaterial } from '@/rendering/materials';

const SHARED_BOX = new THREE.BoxGeometry(1, 1, 1);

/**
 * A wall / ramp segment: one physics {@link Segment} plus a stretched box mesh.
 * Pooled — the level streamer reconfigures its endpoints and colour as chunks
 * scroll, and toggles it in/out of both the physics world and the scene graph.
 */
export class WallEntity implements Poolable {
  readonly segment = new Segment();
  readonly mesh: THREE.Mesh;

  constructor(
    scene: THREE.Scene,
    private readonly world: PhysicsWorld,
  ) {
    this.mesh = new THREE.Mesh(SHARED_BOX, wallMaterial());
    this.mesh.visible = false;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
  }

  /** Configure the collider + mesh from world-space endpoints. */
  configure(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    kind: Segment['kind'],
    accent: number,
  ): void {
    const seg = this.segment;
    seg.set(ax, ay, bx, by);
    seg.kind = kind;

    if (kind === 'ramp' || kind === 'bumper') {
      seg.radius = 0.55;
      seg.restitution = kind === 'bumper' ? 1.05 : 0.62;
      seg.friction = 0.05;
      this.mesh.material = neonMaterial(accent, kind === 'bumper' ? 1.7 : 1.2);
    } else {
      seg.radius = 0.4;
      seg.restitution = 0.5;
      seg.friction = 0.06;
      this.mesh.material = wallMaterial();
    }

    // Stretch the unit box along the segment.
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const thickness = seg.radius * 2;
    this.mesh.position.set((ax + bx) * 0.5, (ay + by) * 0.5, 0);
    this.mesh.rotation.z = Math.atan2(dy, dx);
    this.mesh.scale.set(len, thickness, thickness);
  }

  reset(): void {
    this.segment.active = true;
    this.mesh.visible = true;
    this.world.addSegment(this.segment);
  }

  recycle(): void {
    this.segment.active = false;
    this.mesh.visible = false;
    this.world.removeSegment(this.segment);
  }
}
