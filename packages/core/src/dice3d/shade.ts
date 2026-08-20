/**
 * Face shading: normal-vs-light to an opacity step over the token base color.
 *
 * Shading is an opacity overlay, not a computed color, so the die keeps working in both
 * themes -- the base face color and the shading ink each come from the theme, and only
 * the *amount* of ink is computed here. The ceiling lives in `theme/tokens.ts`
 * (`diceShade`) per the no-magic-numbers rule.
 */

import { diceShade } from '../theme/tokens'
import { faceNormal, type DieGeometry } from './geometry'
import { rotate, type Quaternion } from './project'

/** Fixed key light: up, slightly right, toward the viewer. Normalized at module load so
 * the source stays readable as a direction rather than a unit vector. */
const LIGHT: readonly [number, number, number] = (() => {
  const [x, y, z] = [0.35, 0.65, 1]
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
})()

/**
 * How much shadow ink to lay over a face at this orientation: 0 for a face square to
 * the light, up to `diceShade.max` for one turned fully away. Linear in the Lambert
 * term -- with two or three visible faces there is nothing to gain from a fancier
 * falloff.
 */
export function shadeOpacity(
  geometry: DieGeometry,
  faceIndex: number,
  q: Quaternion,
): number {
  const normal = rotate(q, faceNormal(geometry, faceIndex))
  const lambert = Math.max(
    0,
    normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2],
  )
  return diceShade.max * (1 - lambert)
}
