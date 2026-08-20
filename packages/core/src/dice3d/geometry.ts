/**
 * The two die solids, as plain vertex/face tables.
 *
 * Everything here is unit-scale and centred on the origin: the cube has half-extent 1,
 * the icosahedron circumradius ~1.902 (golden-ratio construction) -- the projector
 * normalizes scale, so only the *shape* matters. No DOM, no SVG: this module answers
 * "where are the corners and which corners make which face", nothing else.
 */

export interface DieGeometry {
  /** [x, y, z] per vertex. */
  vertices: readonly (readonly [number, number, number])[]
  /** Vertex indices per face, wound counter-clockwise seen from outside. */
  faces: readonly (readonly number[])[]
  /** The die value each face shows, indexed like `faces`. */
  values: readonly number[]
}

/** Golden ratio: the icosahedron's 12 vertices are the corners of three mutually
 * orthogonal golden rectangles. */
const PHI = (1 + Math.sqrt(5)) / 2

/**
 * A d6. Faces are wound counter-clockwise viewed from outside, and `values` pairs
 * opposite faces to sum to 7 (1<->6, 2<->5, 3<->4), matching a real die.
 */
export const CUBE: DieGeometry = {
  vertices: [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ],
  faces: [
    [4, 5, 6, 7], // +z, toward the viewer at identity
    [1, 0, 3, 2], // -z
    [5, 1, 2, 6], // +x
    [0, 4, 7, 3], // -x
    [7, 6, 2, 3], // +y
    [0, 1, 5, 4], // -y
  ],
  values: [1, 6, 2, 5, 3, 4],
}

/** The icosahedron's vertices: cyclic permutations of (0, ±1, ±phi). */
const ICO_VERTICES: readonly (readonly [number, number, number])[] = [
  [-1, PHI, 0],
  [1, PHI, 0],
  [-1, -PHI, 0],
  [1, -PHI, 0],
  [0, -1, PHI],
  [0, 1, PHI],
  [0, -1, -PHI],
  [0, 1, -PHI],
  [PHI, 0, -1],
  [PHI, 0, 1],
  [-PHI, 0, -1],
  [-PHI, 0, 1],
]

/** The 20 triangles, wound counter-clockwise from outside (standard tiling). */
const ICO_FACES: readonly (readonly number[])[] = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
]

/**
 * Face values laid out so opposite faces sum to 21, the convention on a real d20.
 * Derived, not hand-assigned: the antipodal partner of each face in ICO_FACES was
 * computed from centroids (pairs (0,13) (1,12) (2,11) (3,10) (4,14) (5,17) (6,18)
 * (7,19) (8,15) (9,16)), and pair k carries values k+1 and 20-k. The geometry test
 * recomputes the centroids and asserts every opposite pair sums to 21, so an edit to
 * either table that breaks the pairing fails loudly.
 */
const ICO_VALUES: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 17, 18, 19, 20, 16, 12, 11, 15, 14, 13,
]

export const ICOSAHEDRON: DieGeometry = {
  vertices: ICO_VERTICES,
  faces: ICO_FACES,
  values: ICO_VALUES,
}

/** The geometry for a die with this many faces. Anything that is not a d20 renders as a
 * cube: d6 natively, and any other face count shows its number on a cube face (the same
 * "no standard pip layout past six" fallback the flat die drew as a numeral). */
export function geometryFor(faces: number): DieGeometry {
  return faces === 20 ? ICOSAHEDRON : CUBE
}

/** Outward unit normal of a face, from its winding (Newell's method degenerate case is
 * impossible here: every face is planar and convex by construction). */
export function faceNormal(
  geometry: DieGeometry,
  faceIndex: number,
): readonly [number, number, number] {
  const face = geometry.faces[faceIndex]
  const [ax, ay, az] = geometry.vertices[face[0]]
  const [bx, by, bz] = geometry.vertices[face[1]]
  const [cx, cy, cz] = geometry.vertices[face[2]]
  const ux = bx - ax
  const uy = by - ay
  const uz = bz - az
  const vx = cx - ax
  const vy = cy - ay
  const vz = cz - az
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const length = Math.hypot(nx, ny, nz)
  return [nx / length, ny / length, nz / length]
}

/** Centroid of a face, for depth sorting and decoration placement. */
export function faceCentroid(
  geometry: DieGeometry,
  faceIndex: number,
): readonly [number, number, number] {
  const face = geometry.faces[faceIndex]
  let x = 0
  let y = 0
  let z = 0
  for (const index of face) {
    const [vx, vy, vz] = geometry.vertices[index]
    x += vx
    y += vy
    z += vz
  }
  return [x / face.length, y / face.length, z / face.length]
}

/** The face index that shows `value`. The registries above declare every value exactly
 * once, so this cannot miss for a value the die actually has; a value it does not have
 * (a d20 asked for 21) falls back to face 0 rather than crashing mid-animation. */
export function faceForValue(geometry: DieGeometry, value: number): number {
  const index = geometry.values.indexOf(value)
  return index === -1 ? 0 : index
}
