/**
 * Rotation and perspective projection: 3D geometry in, flat polygons out.
 *
 * Rotations are unit quaternions -- they compose without gimbal
 * lock, which `tumble.ts` relies on to unwind multi-turn tumbles exactly. The output is plain numbers ({points, depth, facing}
 * per face), so the web can join points into an SVG `<polygon>` string and React Native
 * can hand the same array to react-native-svg, with neither owning any math.
 */

import { faceCentroid, faceNormal, type DieGeometry } from './geometry'

/** A unit quaternion [x, y, z, w]. */
export type Quaternion = readonly [number, number, number, number]

export const IDENTITY: Quaternion = [0, 0, 0, 1]

/** Quaternion for a rotation of `angle` radians around a (not necessarily unit) axis. */
export function fromAxisAngle(
  axis: readonly [number, number, number],
  angle: number,
): Quaternion {
  const [x, y, z] = axis
  const length = Math.hypot(x, y, z)
  // A zero axis means "no rotation" rather than NaN -- callers build axes from random
  // drift values that can legitimately be all zero.
  if (length === 0) return IDENTITY
  const half = angle / 2
  const s = Math.sin(half) / length
  return [x * s, y * s, z * s, Math.cos(half)]
}

/** Hamilton product: apply `b` first, then `a`. */
export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

/** Rotate a point by a unit quaternion (q v q-conjugate). */
export function rotate(
  q: Quaternion,
  point: readonly [number, number, number],
): readonly [number, number, number] {
  const [qx, qy, qz, qw] = q
  const [px, py, pz] = point
  // t = 2 (q x v)
  const tx = 2 * (qy * pz - qz * py)
  const ty = 2 * (qz * px - qx * pz)
  const tz = 2 * (qx * py - qy * px)
  // v-rotated = v + w t + q x t
  return [
    px + qw * tx + qy * tz - qz * ty,
    py + qw * ty + qz * tx - qx * tz,
    pz + qw * tz + qx * ty - qy * tx,
  ]
}

/**
 * The rotation that carries unit vector `from` onto unit vector `to` by the shortest
 * arc. For the antiparallel case (from = -to) any perpendicular axis works; a fixed one
 * is chosen so the result stays deterministic.
 */
export function rotationBetween(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
): Quaternion {
  const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2]
  if (dot < -0.999999) {
    // 180deg: rotate around any axis perpendicular to `from`.
    const axis: readonly [number, number, number] =
      Math.abs(from[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    // Gram-Schmidt the helper against `from` to get a true perpendicular.
    const d = axis[0] * from[0] + axis[1] * from[1] + axis[2] * from[2]
    const perp: readonly [number, number, number] = [
      axis[0] - d * from[0],
      axis[1] - d * from[1],
      axis[2] - d * from[2],
    ]
    return fromAxisAngle(perp, Math.PI)
  }
  const cx = from[1] * to[2] - from[2] * to[1]
  const cy = from[2] * to[0] - from[0] * to[2]
  const cz = from[0] * to[1] - from[1] * to[0]
  const length = Math.hypot(cx, cy, cz, 1 + dot)
  return [cx / length, cy / length, cz / length, (1 + dot) / length]
}

export interface ProjectedFace {
  /** Index into geometry.faces / geometry.values. */
  faceIndex: number
  /** Flat [x, y] pairs in a viewBox where the die centre is (0, 0). */
  points: readonly (readonly [number, number])[]
  /** Rotated-space z of the face centroid; larger = nearer the viewer. */
  depth: number
  /** normal dot view: 1 = face-on to the camera, <= 0 = facing away (culled). */
  facing: number
}

/** Camera distance in die radii. Close enough that perspective visibly foreshortens the
 * far edges (the "3D read"), far enough that no face distorts grotesquely. */
const CAMERA_DISTANCE = 4.5

/**
 * Project the die at orientation `q` into 2D. Returns only viewer-facing faces
 * (facing > 0 -- both solids are convex, so backface culling is exact), sorted
 * back-to-front for the painter's algorithm.
 *
 * `radius` is the projected size of the die's circumscribed sphere in viewBox units.
 */
export function projectDie(
  geometry: DieGeometry,
  q: Quaternion,
  radius: number,
): ProjectedFace[] {
  // Normalize so every solid has circumradius 1 before scaling.
  const circumradius = Math.hypot(...geometry.vertices[0])

  const rotated = geometry.vertices.map((v) => rotate(q, v))
  const projected = rotated.map(([x, y, z]) => {
    const zUnit = z / circumradius
    const w = CAMERA_DISTANCE / (CAMERA_DISTANCE - zUnit)
    // SVG y grows downward; 3D y grows upward.
    return [(x / circumradius) * radius * w, (-y / circumradius) * radius * w] as const
  })

  const faces: ProjectedFace[] = []
  geometry.faces.forEach((face, faceIndex) => {
    const normal = rotate(q, faceNormal(geometry, faceIndex))
    // View axis is +z (the camera looks down -z at the origin).
    const facing = normal[2]
    if (facing <= 0) return
    const centroid = rotate(q, faceCentroid(geometry, faceIndex))
    faces.push({
      faceIndex,
      points: face.map((index) => projected[index]),
      depth: centroid[2],
      facing,
    })
  })
  return faces.sort((a, b) => a.depth - b.depth)
}

/**
 * The face's vertices in its own plane: an orthonormal 2D frame with origin at the
 * face centroid, u along the first edge, v perpendicular in-plane (v = normal x u,
 * then y-flipped to match SVG's downward y). Decorations (pips, numerals) are authored
 * in these coordinates and carried onto the projected polygon by `decorationTransform`.
 */
export function faceLocalCoords(
  geometry: DieGeometry,
  faceIndex: number,
): readonly (readonly [number, number])[] {
  const face = geometry.faces[faceIndex]
  const centroid = faceCentroid(geometry, faceIndex)
  const normal = faceNormal(geometry, faceIndex)
  const [ax, ay, az] = geometry.vertices[face[0]]
  const [bx, by, bz] = geometry.vertices[face[1]]
  let ux = bx - ax
  let uy = by - ay
  let uz = bz - az
  const uLength = Math.hypot(ux, uy, uz)
  ux /= uLength
  uy /= uLength
  uz /= uLength
  const vx = normal[1] * uz - normal[2] * uy
  const vy = normal[2] * ux - normal[0] * uz
  const vz = normal[0] * uy - normal[1] * ux
  return face.map((index) => {
    const [px, py, pz] = geometry.vertices[index]
    const dx = px - centroid[0]
    const dy = py - centroid[1]
    const dz = pz - centroid[2]
    // v is negated so local y grows downward, like the projected SVG plane.
    return [dx * ux + dy * uy + dz * uz, -(dx * vx + dy * vy + dz * vz)] as const
  })
}

/**
 * The 2D affine [a, b, c, d, e, f] (SVG matrix() order) carrying face-local
 * coordinates onto the projected polygon, solved from the first three vertices.
 * Exact for a face square to the camera; for tilted faces it is the affine
 * approximation of the perspective map, which is only used for decoration placement
 * where the error is invisible at this camera distance.
 */
export function decorationTransform(
  local: readonly (readonly [number, number])[],
  projected: readonly (readonly [number, number])[],
): readonly [number, number, number, number, number, number] {
  const [[lx0, ly0], [lx1, ly1], [lx2, ly2]] = [local[0], local[1], local[2]]
  const [[px0, py0], [px1, py1], [px2, py2]] = [projected[0], projected[1], projected[2]]
  // Solve M [l 1] = p for the 2x3 matrix M using the two edge vectors from vertex 0.
  const e1x = lx1 - lx0
  const e1y = ly1 - ly0
  const e2x = lx2 - lx0
  const e2y = ly2 - ly0
  const det = e1x * e2y - e2x * e1y
  const p1x = px1 - px0
  const p1y = py1 - py0
  const p2x = px2 - px0
  const p2y = py2 - py0
  const a = (p1x * e2y - p2x * e1y) / det
  const c = (p2x * e1x - p1x * e2x) / det
  const b = (p1y * e2y - p2y * e1y) / det
  const d = (p2y * e1x - p1y * e2x) / det
  const e = px0 - a * lx0 - c * ly0
  const f = py0 - b * lx0 - d * ly0
  return [a, b, c, d, e, f]
}
