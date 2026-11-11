/** Shortest-arc interpolation between two angles (radians). */
export function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

/** Y-up world heading for a grid direction (screen-down is +y, so z is flipped). */
export const faceAngle = (fx: number, fy: number): number => Math.atan2(-fy, fx);

export const pad6 = (n: number): string => String(n).padStart(6, '0');
