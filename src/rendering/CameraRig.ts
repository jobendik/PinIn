import * as THREE from 'three';
import { Config } from '@/config/GameConfig';
import { damp } from '@/math/MathUtils';

/**
 * The forced-perspective follow camera for the inclined canyon
 * (blueprint §Rendering / pinout.md).
 *
 * Gameplay happens on a flat X/Y plane, but that plane is reclined away from the
 * camera (the {@link Renderer} tilts the playfield group by `-tilt` about X). In
 * world space this gives two basis vectors:
 *
 *   U — "up the incline": where increasing gameplay-Y goes  = (0, cosθ, -sinθ)
 *   N — the playfield surface normal (out toward the viewer) = (0, sinθ,  cosθ)
 *
 * A gameplay point (x, y) maps to world `x·X̂ + y·U`. The camera tracks the
 * ball's Y with exponential damping, sits `height` above the surface along N and
 * `back` down the incline along −U, and looks `lookAhead` up-canyon — producing
 * the signature ascending 3/4 view.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private followY = 0;
  private targetY = 0;

  private readonly U = new THREE.Vector3();
  private readonly N = new THREE.Vector3();
  private readonly focus = new THREE.Vector3();
  private readonly look = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(Config.camera.fov, aspect, 0.1, 700);
    const t = Config.camera.tilt;
    this.U.set(0, Math.cos(t), -Math.sin(t));
    this.N.set(0, Math.sin(t), Math.cos(t));
    this.snapTo(0);
  }

  /** Current (damped) follow height in gameplay-Y — used to anchor the floor. */
  get follow(): number {
    return this.followY;
  }

  /** World-space "up the incline" basis vector (read-only). */
  get inclineUp(): THREE.Vector3 {
    return this.U;
  }

  /** World-space playfield normal (read-only). */
  get surfaceNormal(): THREE.Vector3 {
    return this.N;
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
    const { height, back, lookAhead } = Config.camera;
    // focus = the point on the playfield directly under the ball's height.
    this.focus.copy(this.U).multiplyScalar(this.followY);

    // camPos = focus + N·height − U·back
    this.camera.position
      .copy(this.focus)
      .addScaledVector(this.N, height)
      .addScaledVector(this.U, -back);

    // lookAt = focus + U·lookAhead
    this.look.copy(this.focus).addScaledVector(this.U, lookAhead);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.look);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
