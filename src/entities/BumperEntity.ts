import * as THREE from 'three';
import type { Poolable } from '@/core/ObjectPool';
import { CircleCollider } from '@/physics/CircleCollider';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { neonMaterial, glowMaterial } from '@/rendering/materials';

const RADIUS = 1.5;
const DISC = new THREE.CylinderGeometry(RADIUS, RADIUS * 1.05, 1.1, 24);
// Lay the cylinder flat so its circular face points out of the playfield (+Z).
DISC.rotateX(Math.PI / 2);
const RING = new THREE.TorusGeometry(RADIUS * 1.02, 0.16, 8, 28);
const CORE = new THREE.SphereGeometry(RADIUS * 0.42, 16, 16);

/**
 * A pop bumper — the glowing shield disc that kicks the ball away with a lively
 * restitution. A {@link CircleCollider} drives the physics; the mesh is a domed
 * disc with a bright ring and a pulsing core.
 */
export class BumperEntity implements Poolable {
  readonly collider = new CircleCollider();
  readonly group = new THREE.Group();
  private readonly core: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  private pulse = 0;

  constructor(parent: THREE.Object3D, private readonly world: PhysicsWorld) {
    const body = new THREE.Mesh(DISC, neonMaterial(0x14e0ff, 0.9));
    const ring = new THREE.Mesh(RING, neonMaterial(0xffffff, 1.8));
    ring.position.z = 0.6;
    this.core = new THREE.Mesh(CORE, neonMaterial(0x14e0ff, 2.4));
    this.core.position.z = 0.7;
    this.glow = new THREE.Mesh(CORE, glowMaterial(0x14e0ff, 0.3));
    this.glow.scale.setScalar(2.2);
    this.glow.position.z = 0.7;
    this.group.add(body, ring, this.core, this.glow);
    this.group.visible = false;
    parent.add(this.group);
  }

  configure(x: number, y: number, color: number): void {
    this.collider.set(x, y, RADIUS);
    this.group.position.set(x, y, 0.2);
    this.core.material = neonMaterial(color, 2.4);
    (this.glow.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.group.visible = true;
  }

  animate(dt: number): void {
    if (!this.group.visible) return;
    this.pulse += dt * 3;
    const s = 1 + Math.sin(this.pulse) * 0.12;
    this.glow.scale.setScalar(2.2 * s);
  }

  reset(): void {
    this.collider.active = true;
    this.world.addBumper(this.collider);
  }

  recycle(): void {
    this.collider.active = false;
    this.world.removeBumper(this.collider);
    this.group.visible = false;
  }
}
