import * as THREE from 'three';
import { Config } from '@/config/GameConfig';

/**
 * The dark canyon massif flanking the play lane.
 *
 * PinOut's frame is not empty void: the neon table is carved into a *canyon* —
 * black rock walls rising on both sides that catch a hint of the biome light
 * and vanish into fog. Two layers of long dark slabs (a near rim and a taller
 * far massif) are parented to the playfield and slid along with the camera, so
 * the canyon appears continuous with zero per-frame geometry work. They sit
 * well below the bloom threshold, keeping the glow strictly on the rails.
 */
export class CanyonWalls {
  readonly group = new THREE.Group();
  private readonly nearMat: THREE.MeshStandardMaterial;
  private readonly farMat: THREE.MeshStandardMaterial;

  constructor() {
    const length = 380;
    const half = Config.level.laneWidth * 0.5;

    this.nearMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a18,
      roughness: 0.95,
      metalness: 0.05,
      emissive: new THREE.Color(0x05050d),
      emissiveIntensity: 0.5,
    });
    this.farMat = new THREE.MeshStandardMaterial({
      color: 0x06060f,
      roughness: 1.0,
      metalness: 0.0,
      emissive: new THREE.Color(0x030308),
      emissiveIntensity: 0.4,
    });

    // Near rim: clears the meandering boundary rails (|x| can reach ~13.6).
    const nearGeo = new THREE.BoxGeometry(14, length, 10);
    // Far massif: taller, darker, for parallax depth against the fog.
    const farGeo = new THREE.BoxGeometry(18, length, 18);

    for (const s of [-1, 1]) {
      const near = new THREE.Mesh(nearGeo, this.nearMat);
      near.position.set(s * (half + 10), 0, 3.4);
      this.group.add(near);

      const far = new THREE.Mesh(farGeo, this.farMat);
      far.position.set(s * (half + 21), 0, 6.5);
      this.group.add(far);
    }
    for (const child of this.group.children) child.frustumCulled = false;
  }

  /** Tint the rock faintly toward the biome background so it never goes flat. */
  setPalette(background: number): void {
    const bg = new THREE.Color(background);
    this.nearMat.color.copy(bg).lerp(new THREE.Color(0xffffff), 0.07);
    this.nearMat.emissive.copy(bg).multiplyScalar(0.7);
    this.farMat.color.copy(bg).lerp(new THREE.Color(0x000000), 0.35);
    this.farMat.emissive.copy(bg).multiplyScalar(0.45);
  }

  /** Keep the massif centred under the camera so the canyon never ends. */
  follow(y: number): void {
    this.group.position.y = y;
  }
}
