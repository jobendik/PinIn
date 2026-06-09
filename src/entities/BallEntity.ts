import * as THREE from 'three';
import { Config } from '@/config/GameConfig';
import { Ball } from '@/physics/Ball';
import { BallTrail } from '@/rendering/BallTrail';
import { neonMaterial, glowMaterial } from '@/rendering/materials';
import { lerp } from '@/math/MathUtils';

/**
 * Visual representation of the pinball.
 *
 * PinOut's ball reads as a white-hot point of light streaking through the
 * canyon, with the *biome* colour living in its halo and ribbon trail — so the
 * core stays a constant white-hot sphere and only the glow/trail are tinted.
 */
export class BallEntity {
  /** Visual Z height above the floor so the ball reads as resting on it. */
  private static readonly Z = Config.ball.radius;
  readonly group = new THREE.Group();
  readonly trail: BallTrail;
  private readonly mesh: THREE.Mesh;
  private readonly glow: THREE.Mesh;

  constructor(scene: THREE.Object3D, color: number) {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(Config.ball.radius, 24, 24),
      neonMaterial(0xffffff, 2.0),
    );
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(Config.ball.radius * 1.7, 16, 16),
      glowMaterial(color, 0.22),
    );
    this.group.add(this.mesh, this.glow);
    this.group.renderOrder = 3;
    scene.add(this.group);

    this.trail = new BallTrail(color);
    scene.add(this.trail.mesh);
  }

  setColor(color: number): void {
    (this.glow.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.trail.setColor(color);
  }

  /** Interpolate between the last two physics positions for smooth rendering. */
  sync(ball: Ball, alpha: number): void {
    const x = lerp(ball.prevPosition.x, ball.position.x, alpha);
    const y = lerp(ball.prevPosition.y, ball.position.y, alpha);
    this.group.position.set(x, y, BallEntity.Z);
    this.trail.update(x, y);
  }

  reset(x: number, y: number): void {
    this.group.position.set(x, y, BallEntity.Z);
    this.trail.reset(x, y);
  }
}
