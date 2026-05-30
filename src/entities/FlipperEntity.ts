import * as THREE from 'three';
import { Config } from '@/config/GameConfig';
import { Flipper } from '@/physics/Flipper';
import { neonMaterial } from '@/rendering/materials';

/**
 * Visual for a {@link Flipper}: a capsule-ish bar pinned at the pivot whose
 * rotation mirrors the physics body exactly (no separate animation — the mesh
 * reads the solved angle each frame).
 */
export class FlipperEntity {
  readonly mesh: THREE.Mesh;

  /** Visual Z height above the floor so the flipper reads as a raised bat. */
  private static readonly Z = 0.8;

  constructor(scene: THREE.Object3D, private readonly flipper: Flipper, color: number) {
    const len = Config.flipper.length;
    const w = Config.flipper.width;
    const geo = new THREE.CapsuleGeometry(w * 0.5, len, 4, 8);
    // CapsuleGeometry is built along Y; rotate so it lies along +X from pivot.
    geo.rotateZ(-Math.PI / 2);
    geo.translate(len * 0.5, 0, 0);
    this.mesh = new THREE.Mesh(geo, neonMaterial(color, 1.5));
    this.mesh.position.set(flipper.pivot.x, flipper.pivot.y, FlipperEntity.Z);
    scene.add(this.mesh);
  }

  setColor(color: number): void {
    this.mesh.material = neonMaterial(color, 1.5);
  }

  sync(): void {
    this.mesh.position.set(this.flipper.pivot.x, this.flipper.pivot.y, FlipperEntity.Z);
    this.mesh.rotation.z = this.flipper.angle;
  }
}
