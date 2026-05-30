import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Config } from '@/config/GameConfig';
import { CameraRig } from './CameraRig';
import { createMistPass } from './MistPass';
import { GridFloor } from './GridFloor';

/**
 * Owns the WebGL renderer, scene, and the multi-pass post-processing stack that
 * produces the neon synthwave aesthetic:
 *
 *   RenderPass → UnrealBloomPass (luminance-thresholded "selective" bloom)
 *              → MistPass (screen-space edge blur) → OutputPass (ACES tonemap)
 *
 * ACES tone mapping keeps heavily-bloomed pinks/blues from washing out to pure
 * white (blueprint §Achieving the Neon Glow).
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  /**
   * All gameplay meshes live in this group, which is reclined about X so the
   * flat 2D playfield is presented as a steep 3D canyon (see {@link CameraRig}).
   * Entities add their meshes here, never to the scene directly.
   */
  readonly playfield = new THREE.Group();
  readonly cameraRig: CameraRig;
  readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly mistPass: ShaderPass;
  private readonly fog: THREE.FogExp2;
  private readonly gridFloor = new GridFloor();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = Config.bloom.exposure;

    this.fog = new THREE.FogExp2(0x05010f, 0.018);
    this.scene.fog = this.fog;

    // Recline the whole gameplay plane into a steep canyon, then add it + floor.
    this.playfield.rotation.x = -Config.camera.tilt;
    this.playfield.add(this.gridFloor.mesh);
    this.scene.add(this.playfield);

    // Subtle ambient + a key light so MeshStandardMaterial walls read as 3D.
    this.scene.add(new THREE.AmbientLight(0x2a3a52, 0.7));
    const key = new THREE.DirectionalLight(0x9fc8ff, 0.5);
    key.position.set(0.2, 1, 0.6);
    this.scene.add(key);

    this.cameraRig = new CameraRig(window.innerWidth / window.innerHeight);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.cameraRig.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      Config.bloom.strength,
      Config.bloom.radius,
      Config.bloom.threshold,
    );
    this.composer.addPass(this.bloomPass);

    this.mistPass = createMistPass(window.innerWidth, window.innerHeight);
    this.composer.addPass(this.mistPass);

    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', this.onResize);
  }

  /** Update fog + clear colour to match the active biome palette. */
  setBackground(color: number): void {
    this.fog.color.setHex(color);
    this.renderer.setClearColor(color, 1);
  }

  /** Tint the grid floor to the active biome accent. */
  setAccent(color: number): void {
    this.gridFloor.setAccent(color);
  }

  render(dt: number): void {
    this.cameraRig.update(dt);
    this.gridFloor.follow(this.cameraRig.follow);
    this.composer.render();
  }

  private readonly onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.cameraRig.resize(w / h);
    this.bloomPass.resolution.set(w, h);
    this.mistPass.uniforms.uResolution.value.set(w, h);
  };

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.composer.dispose();
    this.renderer.dispose();
  }
}
