"""Storm math shared by every storm card.

Not a registered card -- the same supporting role validation.py plays. Each storm
card's compute() stays specific to its own per-copy effect (damage, mill, life,
tokens); the only genuinely shared piece is the copy count, which is subtle enough
to be worth one tested home.
"""


def total_copies(storm_count: int) -> int:
    """How many times a storm spell resolves: its copies, plus the original.

    The "+1" is the original spell, which resolves alongside the copies storm made.
    Storm's own copies are put onto the stack, never *cast*, so they don't feed the
    storm count of a later spell in the same turn.
    """
    return storm_count + 1
