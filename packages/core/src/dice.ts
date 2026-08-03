/**
 * Roll math, the die's counterpart to `flipCoin()`. Randomness lives here at the edge so
 * a screen can decide a roll up front and merely *reveal* it when the tumble ends -- the
 * same principle `DieRoller`/`DiceScreen` rely on -- while these functions stay pure and
 * trivially testable.
 *
 * `rng` is injectable (defaulting to `Math.random`) so a caller and a test can pin an
 * exact face instead of "some number". No DOM here, so this is importable from a React
 * Native port unchanged.
 */
export function rollDie(faces: number, rng: () => number = Math.random): number {
  // Math.random() is [0, 1): floor(rng() * faces) is 0..faces-1, so +1 gives 1..faces.
  return Math.floor(rng() * faces) + 1
}

export function rollDice(count: number, faces: number, rng: () => number = Math.random): number[] {
  return Array.from({ length: count }, () => rollDie(faces, rng))
}
