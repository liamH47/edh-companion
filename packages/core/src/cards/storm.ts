/**
 * Storm math shared by every storm card. Mirrors `backend/app/cards/storm.py`.
 *
 * Not a card -- the same supporting role validation plays. Each storm card's own
 * compute stays specific to its per-copy effect; the only genuinely shared piece is
 * the copy count, which is subtle enough to be worth one tested home.
 */

/**
 * How many times a storm spell resolves: its copies, plus the original.
 *
 * The "+1" is the original spell, which resolves alongside the copies storm made.
 * Storm's own copies are put onto the stack, never *cast*, so they don't feed the
 * storm count of a later spell in the same turn.
 */
export function totalCopies(stormCount: number): number {
  return stormCount + 1
}
