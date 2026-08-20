# Real 3D dice

Status: implemented. Supersedes the flat-die parts of `coin-and-dice.md` (see the
erratum there); the d6 is a projected cube and the d20 a true icosahedron.

## What was wrong with the flat die

The first die was a square that spun in place while its faces flickered — no travel, no
bounce, and it landed on an exact multiple of 360°, which reads as a spinner that
stopped. A keyframe pass (throw arc, decaying bounces, off-axis settle) improved the
rhythm but the object itself was still a flat square, and a d20 was a numeral on that
same square. The bar was set explicitly: dice that actually move around in 3D, and a
d20 that is an actual d20.

## Architecture: own math, SVG polygons, no dependencies

`packages/core/src/dice3d/` is pure math with zero deps, 100%-covered:

- `geometry.ts` — cube and regular icosahedron as vertex/face tables. Face values pair
  opposite faces to the traditional sums (7 on a d6, 21 on a d20); the icosahedron's
  pairing was **derived** from antipodal centroids, not hand-assigned, and the test
  recomputes it. Any die that is not a d20 renders on the cube (a d12 shows its
  numeral on a cube face, the same fallback the flat die had).
- `project.ts` — quaternion rotation, perspective projection, exact backface culling
  (both solids are convex), painter's sort. Also the face-local 2D frame and the
  affine that carries it onto the projected polygon, which is how pips and numerals
  sit *on* a face instead of floating over it.
- `shade.ts` — Lambert term against a fixed key light, mapped to an opacity of shadow
  ink over the token face color. The ceiling is `diceShade.max` in `theme/tokens.ts`;
  shading is an opacity overlay rather than a computed color so both themes keep
  working untouched.
- `tumble.ts` — the roll as a continuous pose: sample `poseAt(t)` and draw. Solved
  backwards from the landing: the orientation that faces the rolled value at the
  camera is computed exactly (`rotationBetween`), a bounded spin around the view axis
  adds the "fell askew" read, and the flight unwinds 2.5 full tumbles in front of that
  pose. The unwind angle is parameterized directly — **slerp cannot do this**: it
  always takes the shortest arc, so it would collapse two and a half turns into half
  of one. Bounce heights decay by restitution 0.55 (cloth, not wood).

`apps/web/src/cards/Die3D.tsx` is the only web-shaped part: a requestAnimationFrame
loop sampling `tumblePath`, drawing `<polygon>`s. It owns no math.

Rejected alternatives, for the record: **three.js** (~150KB into an app with two
runtime deps, and WebGL is untestable in jsdom — the scene would need this repo's
first coverage exclusion for a visual); **canvas 2D** (fails portability checklist #5,
also unimplemented in jsdom); **CSS preserve-3d** (no RN equivalent, and a d20 means
20 hand-placed triangles).

## Decisions

- **Rest orientation is exact-face-plus-roll-only-tilt.** The rotation that lands the
  rolled face toward the camera is solved, never sampled; the randomness is confined
  to a ≤12° spin around the view axis, which rotates the face in-plane without
  foreshortening it. That is what keeps pips and numerals legible with plain 2D
  transforms instead of projective text warping.
- **No decorations mid-tumble.** A spinning numeral is unreadable however correctly it
  is warped, so faces are bare during flight; the landed face's pips or numeral fade
  in (opacity) from the final contact through the settle. A real die shows its number
  the moment it stops moving.
- **The numeral is drawn upright**, whatever the resting tilt: the tilt is charm on
  the silhouette, not on the number the player has to read. Pips follow the face's
  frame instead — a pip grid has no up.
- **Contact schedule is shared with the sound.** `CONTACT_FRACTIONS` in
  `dieAnimation.ts` times the bounces, and `backend/tools/generate_roll_sound.py`
  synthesizes `roll.wav` from the same array (regex-parsed from the source file; a CI
  `--check` fails if they drift). The tumble's hops land on those fractions, so the
  thuds are on the frames where the die touches down.
- **Colors are theme CSS variables passed as literal SVG props** (`var(--color-…)`),
  never Tailwind fill classes — react-native-svg takes fill/stroke as props, and
  per-face shading is computed at render time so a build-time class could not express
  it anyway.
- **Reduced motion runs no animation loop at all.** The die renders its final pose and
  eases in via an opacity transition over the already-shortened `revealDuration()`
  (150ms). Same principle as the reveal exception in `design-tokens.md`: the result
  must still arrive as an event, but nothing needs to fly.

## Testing

All math is asserted in `packages/core/src/dice3d/dice3d.test.ts`: winding, value
pairing, culling counts, depth sort, foreshortening, shade bounds, and — the load-
bearing one — that `tumblePath(faces, value, seed).rest` projects the rolled value as
the frontmost face for **every value on both dice**, square to the camera. The web
component is tested with a hand-cranked rAF stub (explicit timestamps, no wall clock):
hidden-then-fading decorations, transform leaving and returning to rest, icosahedron
face counts, reduced-motion static pose, frame cleanup on unmount.
