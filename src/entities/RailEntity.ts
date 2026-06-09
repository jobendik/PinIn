import * as THREE from 'three';
import type { Poolable } from '@/core/ObjectPool';
import { Segment } from '@/physics/Segment';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { neonMaterial } from '@/rendering/materials';
import { railPhysics, railVisual, type RailKind, type RailPoint } from '@/level/railProps';

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

    const phys = railPhysics(kind);
    const vis = railVisual(kind);
    this.tubeRadius = vis.tubeRadius;

    // --- Collider chain along the polyline. ---
    this.activeSegments = n - 1;
    for (let i = 0; i < n - 1; i++) {
      const seg = this.segments[i];
      seg.set(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
      seg.radius      = phys.collisionRadius;
      seg.restitution = phys.restitution;
      seg.friction    = phys.friction;
      seg.kick        = phys.kick;
      seg.kickUp      = phys.kickUp;
      seg.oneWayY     = phys.oneWayY;
      // The renderer treats 'rail' and 'wall' identically; map to the shared tag.
      seg.kind        = kind === 'rail' ? 'wall' : kind;
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
    this.mesh.material = neonMaterial(accent, vis.intensity);
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
