import * as THREE from 'three';

// The PoC was written against three r128, which used legacy colour handling (hex colours are used
// as-is, no sRGB→linear conversion) and legacy light intensities (see LEGACY_LIGHT). Reproducing
// that keeps the palette and shading exactly as designed.
//
// This must run before any material or colour is created. Every render module imports the palette,
// and the palette imports this file, so evaluation order guarantees it.
THREE.ColorManagement.enabled = false;

/** r128 scaled light intensities by π; modern three does not. Multiply to get the same shading. */
export const LEGACY_LIGHT = Math.PI;
