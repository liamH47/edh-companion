/**
 * Splitting a Commander field into pods.
 *
 * Minimum pod size 3, ideal 4 -- so maximise pods of four and make up the remainder
 * with threes. Every count from 3 up can be written as 4a + 3b **except 5**, which
 * resolves as a single pod of five: nobody sits out. Byes have no place in Commander,
 * where a table of three is a perfectly good game.
 *
 *    3  [3]          8  [4,4]        13  [4,3,3,3]
 *    4  [4]          9  [3,3,3]      14  [4,4,3,3]
 *    5  [5]         10  [4,3,3]      15  [4,4,4,3]
 *    6  [3,3]       11  [4,4,3]      16  [4,4,4,4]
 *    7  [4,3]       12  [4,4,4]
 */

export const MIN_POD_SIZE = 3
export const IDEAL_POD_SIZE = 4

/**
 * Pod sizes for `entrantCount`, largest first.
 *
 * The arithmetic is just "how many threes does the remainder need": a count that is
 * 1 more than a multiple of 4 needs three of them (3x3 = 9 ≡ 1 mod 4), 2 more needs
 * two, 3 more needs one. Below the minimum pod size everyone sits at one table --
 * a two-player "pod" is a duel, which is still a game, and refusing to pair them
 * would be worse than the alternative.
 */
export function podSizes(entrantCount: number): number[] {
  if (entrantCount <= 0) return []
  if (entrantCount < MIN_POD_SIZE) return [entrantCount]
  // The one count that no combination of 3s and 4s can reach.
  if (entrantCount === 5) return [5]

  const threes = [0, 3, 2, 1][entrantCount % IDEAL_POD_SIZE]
  const fours = (entrantCount - threes * MIN_POD_SIZE) / IDEAL_POD_SIZE

  return [
    ...Array.from({ length: fours }, () => IDEAL_POD_SIZE),
    ...Array.from({ length: threes }, () => MIN_POD_SIZE),
  ]
}
