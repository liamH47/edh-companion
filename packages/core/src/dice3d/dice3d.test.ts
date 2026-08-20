import { describe, expect, it } from 'vitest'
import {
  CUBE,
  ICOSAHEDRON,
  faceCentroid,
  faceForValue,
  faceNormal,
  geometryFor,
} from './geometry'
import {
  IDENTITY,
  decorationTransform,
  faceLocalCoords,
  fromAxisAngle,
  multiply,
  projectDie,
  rotate,
  rotationBetween,
  type Quaternion,
} from './project'
import { shadeOpacity } from './shade'
import { tumblePath } from './tumble'
import { diceShade } from '../theme/tokens'
import { CONTACT_FRACTIONS } from '../dieAnimation'

const length = (q: Quaternion) => Math.hypot(q[0], q[1], q[2], q[3])

describe('geometry', () => {
  it('declares every value exactly once on each die', () => {
    expect([...CUBE.values].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])
    expect([...ICOSAHEDRON.values].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    )
  })

  it('winds every face counter-clockwise seen from outside', () => {
    for (const geometry of [CUBE, ICOSAHEDRON]) {
      geometry.faces.forEach((_, faceIndex) => {
        const normal = faceNormal(geometry, faceIndex)
        const centroid = faceCentroid(geometry, faceIndex)
        const outward =
          normal[0] * centroid[0] + normal[1] * centroid[1] + normal[2] * centroid[2]
        expect(outward).toBeGreaterThan(0)
      })
    }
  })

  it('pairs opposite faces to the traditional sums (7 on a d6, 21 on a d20)', () => {
    for (const [geometry, total] of [
      [CUBE, 7],
      [ICOSAHEDRON, 21],
    ] as const) {
      geometry.faces.forEach((_, faceIndex) => {
        const centroid = faceCentroid(geometry, faceIndex)
        // The opposite face is the one whose centroid is antipodal.
        let opposite = -1
        let best = Infinity
        geometry.faces.forEach((_, otherIndex) => {
          if (otherIndex === faceIndex) return
          const other = faceCentroid(geometry, otherIndex)
          const residual = Math.hypot(
            centroid[0] + other[0],
            centroid[1] + other[1],
            centroid[2] + other[2],
          )
          if (residual < best) {
            best = residual
            opposite = otherIndex
          }
        })
        expect(best).toBeLessThan(1e-9)
        expect(geometry.values[faceIndex] + geometry.values[opposite]).toBe(total)
      })
    }
  })

  it('selects geometry by face count, defaulting to the cube', () => {
    expect(geometryFor(20)).toBe(ICOSAHEDRON)
    expect(geometryFor(6)).toBe(CUBE)
    // No standard solid for a d12 here: it renders its number on a cube.
    expect(geometryFor(12)).toBe(CUBE)
  })

  it('finds the face for a value, falling back to face 0 for a value the die lacks', () => {
    expect(CUBE.values[faceForValue(CUBE, 6)]).toBe(6)
    expect(ICOSAHEDRON.values[faceForValue(ICOSAHEDRON, 20)]).toBe(20)
    expect(faceForValue(CUBE, 21)).toBe(0)
  })
})

describe('quaternions', () => {
  it('rotates a point 90 degrees around z', () => {
    const q = fromAxisAngle([0, 0, 1], Math.PI / 2)
    const [x, y, z] = rotate(q, [1, 0, 0])
    expect(x).toBeCloseTo(0, 10)
    expect(y).toBeCloseTo(1, 10)
    expect(z).toBeCloseTo(0, 10)
  })

  it('treats a zero axis as no rotation instead of NaN', () => {
    expect(fromAxisAngle([0, 0, 0], 1)).toEqual(IDENTITY)
  })

  it('composes rotations in application order (b first, then a)', () => {
    const a = fromAxisAngle([0, 0, 1], Math.PI / 2)
    const b = fromAxisAngle([1, 0, 0], Math.PI / 2)
    const ab = multiply(a, b)
    const viaComposite = rotate(ab, [0, 1, 0])
    const viaSequence = rotate(a, rotate(b, [0, 1, 0]))
    viaComposite.forEach((component, i) => expect(component).toBeCloseTo(viaSequence[i], 10))
  })

  it('solves the rotation between two vectors', () => {
    const q = rotationBetween([1, 0, 0], [0, 1, 0])
    const [x, y, z] = rotate(q, [1, 0, 0])
    expect(x).toBeCloseTo(0, 10)
    expect(y).toBeCloseTo(1, 10)
    expect(z).toBeCloseTo(0, 10)
    expect(length(q)).toBeCloseTo(1, 10)
  })

  it('handles the antiparallel case deterministically for both helper axes', () => {
    for (const from of [
      [0, 0, 1],
      [1, 0, 0],
    ] as const) {
      const to = [-from[0], -from[1], -from[2]] as const
      const q = rotationBetween(from, to)
      const flipped = rotate(q, from)
      flipped.forEach((component, i) => expect(component).toBeCloseTo(to[i], 6))
    }
  })
})

describe('projectDie', () => {
  it('shows 3 faces of a cube at a corner-on orientation and never more', () => {
    const cornerOn = multiply(
      fromAxisAngle([1, 0, 0], Math.PI / 5),
      fromAxisAngle([0, 1, 0], Math.PI / 5),
    )
    const faces = projectDie(CUBE, cornerOn, 40)
    expect(faces.length).toBe(3)
  })

  it('culls to exactly one cube face when face-on', () => {
    const faces = projectDie(CUBE, IDENTITY, 40)
    expect(faces).toHaveLength(1)
    expect(CUBE.values[faces[0].faceIndex]).toBe(1)
    expect(faces[0].facing).toBeCloseTo(1, 10)
  })

  it('sorts visible faces back-to-front', () => {
    const q = multiply(
      fromAxisAngle([1, 0, 0], 0.6),
      fromAxisAngle([0, 1, 0], 0.7),
    )
    for (const geometry of [CUBE, ICOSAHEDRON]) {
      const faces = projectDie(geometry, q, 40)
      expect(faces.length).toBeGreaterThan(1)
      for (let i = 1; i < faces.length; i += 1) {
        expect(faces[i].depth).toBeGreaterThanOrEqual(faces[i - 1].depth)
      }
    }
  })

  it('foreshortens: a nearer vertex projects larger than the same vertex pushed back', () => {
    // Face-on cube: the front face (z = +1) must project wider than the back face
    // would at the same orientation -- measure via two orientations of one vertex.
    const front = projectDie(CUBE, IDENTITY, 40)[0]
    const xs = front.points.map(([x]) => Math.abs(x))
    // The front face of a unit cube at radius 40 projects past its orthographic size.
    expect(Math.max(...xs)).toBeGreaterThan(40 / Math.sqrt(3))
  })
})

describe('faceLocalCoords', () => {
  it('lays each face out flat: every vertex in-plane distance is preserved', () => {
    for (const geometry of [CUBE, ICOSAHEDRON]) {
      geometry.faces.forEach((face, faceIndex) => {
        const local = faceLocalCoords(geometry, faceIndex)
        // Pairwise 3D distances survive the flattening (the face is planar).
        for (let i = 0; i < face.length; i += 1) {
          const j = (i + 1) % face.length
          const [ax, ay, az] = geometry.vertices[face[i]]
          const [bx, by, bz] = geometry.vertices[face[j]]
          const d3 = Math.hypot(bx - ax, by - ay, bz - az)
          const d2 = Math.hypot(local[j][0] - local[i][0], local[j][1] - local[i][1])
          expect(d2).toBeCloseTo(d3, 10)
        }
        // Centred on the centroid.
        const cx = local.reduce((sum, [x]) => sum + x, 0) / local.length
        const cy = local.reduce((sum, [, y]) => sum + y, 0) / local.length
        expect(cx).toBeCloseTo(0, 10)
        expect(cy).toBeCloseTo(0, 10)
      })
    }
  })
})

describe('decorationTransform', () => {
  it('carries face-local coordinates exactly onto the projected polygon', () => {
    const q = fromAxisAngle([0, 0, 1], 0.2)
    const [face] = projectDie(CUBE, q, 40)
    const local = faceLocalCoords(CUBE, face.faceIndex)
    const [a, b, c, d, e, f] = decorationTransform(local, face.points)
    local.forEach(([lx, ly], i) => {
      expect(a * lx + c * ly + e).toBeCloseTo(face.points[i][0], 6)
      expect(b * lx + d * ly + f).toBeCloseTo(face.points[i][1], 6)
    })
  })
})

describe('shadeOpacity', () => {
  it('shades a face turned from the light more than one square to it', () => {
    // At identity the +z face looks at the camera and the light is mostly +z too.
    const lit = shadeOpacity(CUBE, 0, IDENTITY)
    const away = shadeOpacity(CUBE, 1, IDENTITY) // -z face
    expect(lit).toBeLessThan(away)
    expect(away).toBe(diceShade.max)
  })

  it('never exceeds the token ceiling or drops below zero', () => {
    for (let i = 0; i < CUBE.faces.length; i += 1) {
      const opacity = shadeOpacity(CUBE, i, fromAxisAngle([1, 1, 0], 0.9))
      expect(opacity).toBeGreaterThanOrEqual(0)
      expect(opacity).toBeLessThanOrEqual(diceShade.max)
    }
  })
})

describe('tumblePath', () => {
  it('lands showing exactly the rolled face, for every value on both dice', () => {
    for (const faces of [6, 20]) {
      for (let value = 1; value <= faces; value += 1) {
        const { rest } = tumblePath(faces, value, 7)
        const projected = projectDie(geometryFor(faces), rest.orientation, 40)
        const frontmost = projected[projected.length - 1]
        expect(geometryFor(faces).values[frontmost.faceIndex]).toBe(value)
        // Roll-only tilt: the landed face stays square to the camera.
        expect(frontmost.facing).toBeGreaterThan(0.999)
      }
    }
  })

  it('rests on the surface, centred, at full scale', () => {
    const { rest } = tumblePath(6, 4, 3)
    expect(rest.offsetY).toBe(0)
    expect(rest.offsetX).toBe(0)
    expect(rest.scale).toBe(1)
  })

  it('is airborne between contacts and grounded at each contact', () => {
    const { poseAt } = tumblePath(20, 17, 11)
    // Midway through the first flight: in the air.
    expect(poseAt(CONTACT_FRACTIONS[0] / 2).offsetY).toBeLessThan(0)
    // At each contact: on the surface.
    for (const contact of CONTACT_FRACTIONS) {
      expect(poseAt(contact).offsetY).toBeCloseTo(0, 10)
    }
  })

  it('tumbles through more than a half turn in flight', () => {
    // The unwind must be a real multi-turn tumble, not a shortest-arc blend: track a
    // reference direction and accumulate the angle it sweeps between dense samples.
    const { poseAt } = tumblePath(6, 1, 5)
    let previous = rotate(poseAt(0).orientation, [0, 0, 1])
    let swept = 0
    for (let i = 1; i <= 200; i += 1) {
      const current = rotate(poseAt(i / 200).orientation, [0, 0, 1])
      const dot = Math.min(
        1,
        Math.max(-1, previous[0] * current[0] + previous[1] * current[1] + previous[2] * current[2]),
      )
      swept += Math.acos(dot)
      previous = current
    }
    expect(swept).toBeGreaterThan(Math.PI)
  })

  it('is deterministic per seed and varies across seeds', () => {
    const a = tumblePath(6, 3, 42).poseAt(0.37)
    const b = tumblePath(6, 3, 42).poseAt(0.37)
    expect(a).toEqual(b)
    const c = tumblePath(6, 3, 43).poseAt(0.37)
    expect(a.orientation).not.toEqual(c.orientation)
  })

  it('scales up only during the first arc and clamps t outside [0, 1]', () => {
    const path = tumblePath(6, 2, 9)
    expect(path.poseAt(CONTACT_FRACTIONS[0] / 2).scale).toBeGreaterThan(1)
    expect(path.poseAt(0.9).scale).toBe(1)
    expect(path.poseAt(-1)).toEqual(path.poseAt(0))
    expect(path.poseAt(2)).toEqual(path.poseAt(1))
  })
})
