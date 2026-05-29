import * as THREE from 'three';
import { Config } from '@/config/GameConfig';

/**
 * A GPU-friendly ribbon trail behind the ball (blueprint §Particle Systems).
 *
 * Computing hundreds of CPU particles per frame would cause frame drops, so we
 * keep a fixed ring buffer of historical positions and feed them into a single
 * triangle-strip geometry whose alpha fades with age in the vertex shader. The
 * vertex/index buffers are allocated once and only their contents are updated.
 */
export class BallTrail {
  readonly mesh: THREE.Mesh;
  private readonly count = Config.ball.trailLength;
  private readonly positions: THREE.Vector3[] = [];
  private readonly geometry: THREE.BufferGeometry;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly alphaAttr: THREE.BufferAttribute;
  private readonly width = Config.ball.radius * 1.4;

  constructor(color: number) {
    this.geometry = new THREE.BufferGeometry();
    // Two vertices (left/right of the ribbon) per history sample.
    const verts = this.count * 2;
    this.posAttr = new THREE.BufferAttribute(new Float32Array(verts * 3), 3);
    this.alphaAttr = new THREE.BufferAttribute(new Float32Array(verts), 1);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('aAlpha', this.alphaAttr);

    const indices: number[] = [];
    for (let i = 0; i < this.count - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry.setIndex(indices);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, vAlpha);
        }
      `,
    });

    for (let i = 0; i < this.count; i++) this.positions.push(new THREE.Vector3());
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  setColor(color: number): void {
    (this.mesh.material as THREE.ShaderMaterial).uniforms.uColor.value.set(color);
  }

  reset(x: number, y: number): void {
    for (const p of this.positions) p.set(x, y, 0);
  }

  /** Push the latest ball position and rebuild the ribbon geometry. */
  update(x: number, y: number): void {
    // Shift the ring buffer (small fixed N, cheap).
    for (let i = this.count - 1; i > 0; i--) {
      this.positions[i].copy(this.positions[i - 1]);
    }
    this.positions[0].set(x, y, 0);

    const pos = this.posAttr.array as Float32Array;
    const alpha = this.alphaAttr.array as Float32Array;

    for (let i = 0; i < this.count; i++) {
      const cur = this.positions[i];
      const next = this.positions[Math.min(i + 1, this.count - 1)];
      let dx = next.x - cur.x;
      let dy = next.y - cur.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      // Perpendicular, tapering with age.
      const t = 1 - i / this.count;
      const w = this.width * t;
      const nx = -dy * w;
      const ny = dx * w;

      const vi = i * 2;
      pos[vi * 3 + 0] = cur.x + nx;
      pos[vi * 3 + 1] = cur.y + ny;
      pos[vi * 3 + 2] = 0;
      pos[(vi + 1) * 3 + 0] = cur.x - nx;
      pos[(vi + 1) * 3 + 1] = cur.y - ny;
      pos[(vi + 1) * 3 + 2] = 0;

      const a = t * t * 0.8;
      alpha[vi] = a;
      alpha[vi + 1] = a;
    }

    this.posAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }
}
