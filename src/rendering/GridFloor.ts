import * as THREE from 'three';
import { Config } from '@/config/GameConfig';

/**
 * The neon grid floor of the canyon.
 *
 * A single large plane parented to the (tilted) playfield, sitting just beneath
 * the rails. A shader draws a grid in *playfield space* — the line positions are
 * offset by the camera's follow-Y, so as the plane is repositioned to stay under
 * the ball the grid appears to scroll past, selling continuous forward travel
 * without any per-frame geometry work. Lines fade toward the far edge into fog.
 */
export class GridFloor {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly halfLen: number;

  constructor() {
    const width = Config.level.laneWidth * 2.6;
    const length = 360;
    this.halfLen = length * 0.5;

    const geo = new THREE.PlaneGeometry(width, length, 1, 1);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uScrollY: { value: 0 },
        uAccent: { value: new THREE.Color(0x14e0ff) },
        uSpacing: { value: 7.5 },
        uHalfLen: { value: this.halfLen },
        uHalfWidth: { value: Config.level.laneWidth * 0.5 },
      },
      vertexShader: /* glsl */ `
        varying float vGX;
        varying float vGY;
        varying float vEdge;
        uniform float uScrollY;
        uniform float uHalfLen;
        void main() {
          vGX = position.x;
          vGY = position.y + uScrollY;
          // Fade with distance from the plane centre (→ horizon) and slightly
          // behind the ball so the foreground doesn't glare.
          float ahead = clamp(1.0 - position.y / uHalfLen, 0.0, 1.0);
          float behind = clamp(1.0 + position.y / uHalfLen, 0.0, 1.0);
          vEdge = pow(ahead, 1.3) * pow(behind, 0.6);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying float vGX;
        varying float vGY;
        varying float vEdge;
        uniform vec3 uAccent;
        uniform float uSpacing;
         uniform float uHalfWidth;
        void main() {
          // --- Grid lines. ---
          vec2 g = vec2(vGX, vGY) / uSpacing;
          vec2 grid = abs(fract(g - 0.5) - 0.5);
          vec2 fw = fwidth(g);
          vec2 lines = grid / max(fw, 1e-5);
          float gridLine = 1.0 - min(min(lines.x, lines.y), 1.0);

          // --- Pinball table lane paint: side stripes and centre runway. ---
          float SIDE_STRIPE_X = uHalfWidth * 0.73;    // near the inlanes / side walls
          float CENTRE_STRIPE_X = uHalfWidth * 0.22;  // narrow runway around the climb lane
          float sideStripe = 1.0 - smoothstep(0.0, fwidth(abs(vGX)) * 4.0 + 0.08, abs(abs(vGX) - SIDE_STRIPE_X));
          float centreStripe = 1.0 - smoothstep(0.0, fwidth(abs(vGX)) * 5.0 + 0.05, abs(abs(vGX) - CENTRE_STRIPE_X));

          // --- Up-pointing chevron arrows scrolling down the centre lane. ---
          float v = (vGY + abs(vGX) * 1.3) / 9.0;
          float cb = abs(fract(v) - 0.5);
          float chev = 1.0 - smoothstep(0.0, 0.13, cb);
          chev *= smoothstep(6.5, 3.5, abs(vGX)); // centre lane width
          chev *= step(0.5, abs(vGX));            // hollow centre line

          float intensity = (gridLine * 0.55 + chev * 0.9 + sideStripe * 0.65 + centreStripe * 0.35) * vEdge;
          // A faint filled surface so the floor reads as solid, not void.
          vec3 col = uAccent * intensity + uAccent * 0.06 * vEdge;
          float alpha = intensity * 0.8 + 0.06 * vEdge;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.z = -0.05; // just under the rail bases
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1; // draw before the glowing rails
  }

  setAccent(color: number): void {
    this.material.uniforms.uAccent.value.set(color);
  }

  /** Keep the plane centred under the ball and scroll the grid to match. */
  follow(followY: number): void {
    this.mesh.position.y = followY;
    this.material.uniforms.uScrollY.value = followY;
  }
}
