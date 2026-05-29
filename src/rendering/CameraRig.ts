import * as THREE from 'three';
import { Config } from '@/config/GameConfig';
import { damp } from '@/math/MathUtils';

/**
 * The forced-perspective follow camera (blueprint §Rendering Pipeline).
 *
 * The camera sits behind and below the ball, angled up the inclined playfield,
 * which implies infinite vertical depth. It tracks only the ball's Y with an
 * exponential damping function so high-speed ascents and backward falls read
 * smoothly instead of jittering.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private followY = 0;
  private targetY = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(Config.camera.fov, aspect, 0.1, 400);
    this.camera.position.set(0, 0, Config.camera.distance);
  }

  snapTo(y: number): void {
    this.followY = y;
    this.targetY = y;
    this.apply();
  }

  setTarget(ballY: number): void {
    this.targetY = ballY;
  }

  update(dt: number): void {
    this.followY = damp(this.followY, this.targetY, Config.camera.followLambda, dt);
    this.apply();
  }

  private apply(): void {
    const cam = this.camera;
    cam.position.y = this.followY - Config.camera.height;
    cam.position.z = Config.camera.distance;
    cam.position.x = 0;
    cam.lookAt(0, this.followY + Config.camera.lookAhead, 0);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
