import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import * as THREE from 'three';

/**
 * Screen-space "light mist" (blueprint §Particle Systems & Effects).
 *
 * Rather than expensive volumetric fog, we fake depth-of-field by smearing the
 * top and bottom edges of the frame with a cheap vertical blur. The blur amount
 * ramps up toward both edges, hiding the seams where streamed geometry enters
 * and leaves the frustum and selling the illusion of infinite depth.
 */
const MistShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTopStart: { value: 0.88 },
    uBottomStart: { value: 0.12 },
    uStrength: { value: 0.5 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTopStart;
    uniform float uBottomStart;
    uniform float uStrength;
    varying vec2 vUv;

    void main() {
      // Edge factor: 0 in the clear central band, →1 toward top & bottom edges.
      float top = smoothstep(uTopStart, 1.0, vUv.y);
      float bottom = smoothstep(uBottomStart, 0.0, vUv.y);
      float edge = clamp(max(top, bottom), 0.0, 1.0) * uStrength;

      vec4 color = texture2D(tDiffuse, vUv);
      if (edge > 0.001) {
        float px = (1.0 / uResolution.y) * (1.0 + edge * 5.0);
        // 9-tap vertical Gaussian.
        vec4 sum = color * 0.227027;
        sum += texture2D(tDiffuse, vUv + vec2(0.0, px * 1.0)) * 0.1945946;
        sum += texture2D(tDiffuse, vUv - vec2(0.0, px * 1.0)) * 0.1945946;
        sum += texture2D(tDiffuse, vUv + vec2(0.0, px * 2.0)) * 0.1216216;
        sum += texture2D(tDiffuse, vUv - vec2(0.0, px * 2.0)) * 0.1216216;
        sum += texture2D(tDiffuse, vUv + vec2(0.0, px * 3.0)) * 0.054054;
        sum += texture2D(tDiffuse, vUv - vec2(0.0, px * 3.0)) * 0.054054;
        sum += texture2D(tDiffuse, vUv + vec2(0.0, px * 4.0)) * 0.016216;
        sum += texture2D(tDiffuse, vUv - vec2(0.0, px * 4.0)) * 0.016216;
        color = mix(color, sum, edge);
      }
      gl_FragColor = color;
    }
  `,
};

export function createMistPass(width: number, height: number): ShaderPass {
  const pass = new ShaderPass(MistShader);
  pass.uniforms.uResolution.value.set(width, height);
  return pass;
}
