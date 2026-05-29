import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Config } from '@/config/GameConfig';
import { CameraRig } from './CameraRig';
import { createMistPass } from './MistPass';

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
  readonly cameraRig: CameraRig;
  readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly mistPass: ShaderPass;
  private readonly fog: THREE.FogExp2;

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

    this.fog = new THREE.FogExp2(0x05010f, 0.012);
    this.scene.fog = this.fog;

    // Subtle ambient + a key light so MeshStandardMaterial walls read as 3D.
    this.scene.add(new THREE.AmbientLight(0x223044, 0.6));
    const key = new THREE.PointLight(0xffffff, 0.8, 0, 1.2);
    key.position.set(0, 0, 30);
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

  render(dt: number): void {
    this.cameraRig.update(dt);
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
