import type { FieldValues, OutputValues } from '../../types'

/** Room id -> successor ids, per dungeon. Mirrors the graphs in
 * backend/app/cards/dungeons.py (verified verbatim against Scryfall); a room with no
 * successors is the bottommost room, whose ability resolving completes the dungeon.
 * Only the edges are needed here -- labels and layout ship in the metadata's MapSpec,
 * and compute() reads the walked path alone. */
const SUCCESSORS: Record<string, Record<string, readonly string[]>> = {
  phandelver: {
    'cave-entrance': ['goblin-lair', 'mine-tunnels'],
    'goblin-lair': ['storeroom', 'dark-pool'],
    'mine-tunnels': ['dark-pool', 'fungi-cavern'],
    storeroom: ['temple-of-dumathoin'],
    'dark-pool': ['temple-of-dumathoin'],
    'fungi-cavern': ['temple-of-dumathoin'],
    'temple-of-dumathoin': [],
  },
  tomb: {
    'trapped-entry': ['veils-of-fear', 'oubliette'],
    'veils-of-fear': ['sandfall-cell'],
    oubliette: ['cradle-of-the-death-god'],
    'sandfall-cell': ['cradle-of-the-death-god'],
    'cradle-of-the-death-god': [],
  },
  'mad-mage': {
    'yawning-portal': ['dungeon-level'],
    'dungeon-level': ['goblin-bazaar', 'twisted-caverns'],
    'goblin-bazaar': ['lost-level'],
    'twisted-caverns': ['lost-level'],
    'lost-level': ['runestone-caverns', 'muirals-graveyard'],
    'runestone-caverns': ['deep-mines'],
    'muirals-graveyard': ['deep-mines'],
    'deep-mines': ['mad-wizards-lair'],
    'mad-wizards-lair': [],
  },
  undercity: {
    'secret-entrance': ['forge', 'lost-well'],
    forge: ['trap', 'arena'],
    'lost-well': ['arena', 'stash'],
    trap: ['archives'],
    arena: ['archives', 'catacombs'],
    stash: ['catacombs'],
    archives: ['throne-of-the-dead-three'],
    catacombs: ['throne-of-the-dead-three'],
    'throne-of-the-dead-three': [],
  },
}

/** Mirrors backend/app/cards/dungeons.py. */
export function compute(inputs: FieldValues): OutputValues {
  const dungeon = String(inputs.which_dungeon)
  const rooms = SUCCESSORS[dungeon]
  const path = rooms ? (inputs[`${dungeon.replace(/-/g, '_')}_path`] as string[]) : []

  const roomsEntered = path.length
  // The bottommost room has no successors -- reaching it IS completion by rule
  // (CR 309.6-7): once its ability resolves the dungeon removes itself.
  const lastRoom = path[path.length - 1]
  const atBottom = path.length > 0 && rooms[lastRoom].length === 0

  return {
    dungeons_completed: Number(inputs.dungeons_completed),
    rooms_entered: roomsEntered,
    at_bottom_room: atBottom ? 1 : 0,
    dungeon_complete: atBottom,
  }
}
