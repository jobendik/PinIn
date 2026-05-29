import * as THREE from 'three';

/**
 * Material factory for the neon synthwave look.
 *
 * The bloom pass is luminance-thresholded (blueprint §Rendering): only pixels
 * brighter than the threshold blossom. So every "glowing" element uses a
 * `MeshStandardMaterial` with a saturated emissive colour and an
 * `emissiveIntensity > 1`, while the dark canyon walls stay below the threshold
 * and remain crisp and black.
 */

const cache = new Map<string, THREE.Material>();

function key(parts: (string | number)[]): string {
  return parts.join(':');
}

/** A bright, self-illuminated neon material (ramps, dots, ball). */
export function neonMaterial(color: number, intensity = 2.4): THREE.MeshStandardMaterial {
  const k = key(['neon', color, intensity]);
  const existing = cache.get(k) as THREE.MeshStandardMaterial | undefined;
  if (existing) return existing;

  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0.0,
    toneMapped: true,
  });
  cache.set(k, mat);
  return mat;
}

/** A dim structural material for the dark canyon walls (stays under bloom). */
export function wallMaterial(color = 0x0a0a16): THREE.MeshStandardMaterial {
  const k = key(['wall', color]);
  const existing = cache.get(k) as THREE.MeshStandardMaterial | undefined;
  if (existing) return existing;

  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.25,
    roughness: 0.9,
    metalness: 0.1,
  });
  cache.set(k, mat);
  return mat;
}

/** Soft additive material for dots / power-up glows. */
export function glowMaterial(color: number, opacity = 0.9): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  return mat;
}

export function disposeMaterialCache(): void {
  for (const mat of cache.values()) mat.dispose();
  cache.clear();
}
