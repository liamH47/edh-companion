import { useEffect, useMemo, useState } from 'react'
import {
  CONTACT_FRACTIONS,
  decorationTransform,
  faceForValue,
  faceLocalCoords,
  geometryFor,
  prefersReducedMotion,
  projectDie,
  shadeOpacity,
  tumblePath,
} from '@mtg/core'

/** Projected radius of the die's circumscribed sphere, in viewBox units. */
const DIE_RADIUS = 34

/** The viewBox half-extent. The die overflows it at the top of the first arc, which is
 * the point -- `overflow: visible` lets the throw leave the box the way a real toss
 * leaves your palm, instead of clipping at an invisible ceiling. */
const HALF = 48

/** Pip layout per value on the 3x3 face grid, as [column, row] offsets in face-local
 * units (the cube face spans -1..1 in its own plane). */
const PIP_OFFSET = 0.52
const PIP_RADIUS = 0.17
const PIPS_BY_VALUE: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
}

/** Decorations start fading in at the final contact and are fully opaque at rest: a
 * real die shows its number the moment it stops tumbling, and the settle is the die
 * rocking flat with its result already readable. */
const LAST_CONTACT = CONTACT_FRACTIONS[CONTACT_FRACTIONS.length - 1]

function decorationOpacity(t: number): number {
  if (t <= LAST_CONTACT) return 0
  return (t - LAST_CONTACT) / (1 - LAST_CONTACT)
}

interface Die3DProps {
  /** The value the die lands showing. */
  face: number
  faces: number
  rolling: boolean
  durationMs: number
  /** Varies the tumble and the resting tilt between rolls. The owner supplies it from
   * the same RNG that picked the face, so a test can pin both. */
  seed?: number
}

/**
 * A die as a real solid: cube for six or fewer faces, icosahedron for a d20, projected
 * by `@mtg/core/dice3d` and drawn as SVG polygons. The component owns no math -- it
 * samples `tumblePath` on a requestAnimationFrame clock while `rolling`, and draws the
 * resting pose otherwise. Fills and strokes are theme CSS variables passed as literal
 * props (never Tailwind classes), the pattern react-native-svg can mirror.
 *
 * Purely presentational, like the flat die it replaces: no RNG, no result callback, no
 * announcement. The owner decides the outcome up front and drives `face`/`rolling`,
 * which is what lets DiceScreen land two dice off one shared timer.
 *
 * Reduced motion: no animation loop at all. The die renders its final pose and eases
 * in with an opacity transition over the (already shortened) reveal duration -- the
 * one CSS-animatable property portability-rules.md allows besides transform.
 */
export function Die3D({ face, faces, rolling, durationMs, seed = 1 }: Die3DProps) {
  const [t, setT] = useState(1)
  const reduced = prefersReducedMotion()

  const path = useMemo(() => tumblePath(faces, face, seed), [faces, face, seed])
  const geometry = geometryFor(faces)

  useEffect(() => {
    if (!rolling || reduced) {
      setT(1)
      return
    }
    setT(0)
    let start: number | undefined
    let frame: number
    const step = (timestamp: number) => {
      start ??= timestamp
      const next = Math.min(1, (timestamp - start) / durationMs)
      setT(next)
      if (next < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [rolling, reduced, durationMs, path])

  const pose = path.poseAt(t)
  const projected = projectDie(geometry, pose.orientation, DIE_RADIUS)

  // Decorations live on the landed face only, carried onto its polygon by the affine
  // from its local frame. Mid-tumble they are invisible (a spinning numeral is
  // unreadable noise), fading in from the final contact.
  const landedIndex = faceForValue(geometry, face)
  const landed = projected.find((f) => f.faceIndex === landedIndex)
  const opacity = reduced && rolling ? 0.4 : decorationOpacity(t)
  const pips = faces <= 6 ? PIPS_BY_VALUE[face] : undefined

  let decoration = null
  if (landed && opacity > 0) {
    const local = faceLocalCoords(geometry, landedIndex)
    const [a, b, c, d, e, f] = decorationTransform(local, landed.points)
    if (pips) {
      decoration = (
        <g transform={`matrix(${a} ${b} ${c} ${d} ${e} ${f})`} opacity={opacity}>
          {pips.map(([gx, gy]) => (
            <circle
              key={`${gx},${gy}`}
              cx={gx * PIP_OFFSET}
              cy={gy * PIP_OFFSET}
              r={PIP_RADIUS}
              fill="var(--color-text)"
            />
          ))}
        </g>
      )
    } else {
      // The numeral stays upright regardless of the face's in-plane orientation --
      // the resting tilt is charm on the die's silhouette, not on the number the
      // player has to read. Size follows the face's projected scale.
      const scale = Math.hypot(a, b)
      decoration = (
        <text
          x={e}
          y={f}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={scale * (faces === 20 ? 0.9 : 1.1)}
          fontWeight="bold"
          fill="var(--color-text)"
          opacity={opacity}
        >
          {face}
        </text>
      )
    }
  }

  return (
    <svg
      viewBox={`${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}`}
      className="h-24 w-24"
      style={{ overflow: 'visible' }}
      role="img"
      aria-hidden="true"
    >
      <g
        transform={`translate(${pose.offsetX * DIE_RADIUS} ${pose.offsetY * DIE_RADIUS}) scale(${pose.scale})`}
        style={
          reduced && rolling
            ? { opacity: 0.4, transition: `opacity ${durationMs}ms linear` }
            : undefined
        }
      >
        {projected.map((projectedFace) => {
          const points = projectedFace.points.map(([x, y]) => `${x},${y}`).join(' ')
          const shade = shadeOpacity(geometry, projectedFace.faceIndex, pose.orientation)
          return (
            <g key={projectedFace.faceIndex}>
              <polygon
                points={points}
                fill="var(--color-surface-raised)"
                stroke="var(--color-border)"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              {shade > 0 && <polygon points={points} fill="var(--color-text)" opacity={shade} />}
            </g>
          )
        })}
        {decoration}
      </g>
    </svg>
  )
}
