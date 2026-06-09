import * as THREE from 'three';
import type { Poolable } from '@/core/ObjectPool';
import { Segment } from '@/physics/Segment';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { neonMaterial } from '@/rendering/materials';

export type RailKind = 'rail' | 'ramp' | 'wall';

/** A point on a rail polyline (gameplay X/Y plane). */
export interface RailPoint {
  x: number;
  y: number;
}

const MAX_POINTS = 24;
const TUBE_Z = 1.3; // height of the glowing pipe above the floor
const RAMP_Z = 2.25; // raised above rails so ramps read as overpasses
const RADIAL = 7;

/**
 * A smooth, glowing neon rail — the defining visual of the canyon.
 *
 * Given a polyline, it renders ONE smooth `TubeGeometry` (a Catmull-Rom spline
 * swept into a rounded pipe) for the look, while registering a chain of straight
 * {@link Segment} colliders along the same polyline for the 2D physics. Pooled:
 * the streamer reconfigures the points and colour as boards scroll past.
 */
export class RailEntity implements Poolable {
  readonly mesh: THREE.Mesh;
  private readonly segments: Segment[] = [];
  private activeSegments = 0;
  private tubeRadius = 0.42;

  constructor(
    parent: THREE.Object3D,
    private readonly world: PhysicsWorld,
  ) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), neonMaterial(0x14e0ff, 1.5));
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    for (let i = 0; i < MAX_POINTS - 1; i++) this.segments.push(new Segment());
  }

  configure(points: RailPoint[], kind: RailKind, accent: number): void {
    const n = Math.min(points.length, MAX_POINTS);
    if (n < 2) return;

    this.tubeRadius = kind === 'ramp' ? 0.32 : kind === 'wall' ? 0.5 : 0.42;
    const collisionR = this.tubeRadius;
    // Low bounce: rails should GUIDE the ball along/up the channel, not ricochet
    // it back down. The ball glances off and keeps its upward momentum.
    const restitution = kind === 'ramp' ? 0.5 : 0.4;
    const friction = kind === 'ramp' ? 0.0 : 0.02;

    // --- Collider chain along the polyline. ---
    this.activeSegments = n - 1;
    for (let i = 0; i < n - 1; i++) {
      const seg = this.segments[i];
      seg.set(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
      seg.radius = collisionR;
      seg.restitution = restitution;
      seg.friction = friction;
      seg.kind = kind === 'ramp' ? 'ramp' : 'wall';
      seg.active = true;
      this.world.addSegment(seg);
    }
    for (let i = this.activeSegments; i < this.segments.length; i++) {
      this.segments[i].active = false;
    }

    // --- Smooth tube visual. ---
    const curvePts: THREE.Vector3[] = [];
    const z = kind === 'ramp' ? RAMP_Z : TUBE_Z;
    for (let i = 0; i < n; i++) curvePts.push(new THREE.Vector3(points[i].x, points[i].y, z));
    const curve = new THREE.CatmullRomCurve3(curvePts, false, 'catmullrom', 0.5);
    const tubular = Math.max(8, (n - 1) * 6);
    const geo = new THREE.TubeGeometry(curve, tubular, this.tubeRadius, RADIAL, false);

    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    this.mesh.material = neonMaterial(accent, kind === 'ramp' ? 2.0 : 1.6);
    this.mesh.visible = true;
  }

  reset(): void {
    /* configured explicitly via configure() */
  }

  recycle(): void {
    this.mesh.visible = false;
    for (let i = 0; i < this.activeSegments; i++) {
      this.segments[i].active = false;
      this.world.removeSegment(this.segments[i]);
    }
    this.activeSegments = 0;
  }
}
