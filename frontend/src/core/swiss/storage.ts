import { getJSON, setJSON } from '../storage'
import type { Match, MatchResult, Tournament } from './types'

const TOURNAMENT_KEY = 'mtg-calc-tournament'

/**
 * One active tournament at a time, held on the device. Nothing about a tournament
 * goes to the server -- pairing and standings are pure functions in this directory --
 * so a draft keeps working through a dead connection.
 */

/** The pre-pod shape: a match was always exactly two sides, or one plus a bye. */
interface LegacyMatch {
  id: string
  aEntrantId: string
  bEntrantId: string | null
  result: { aGameWins: number; bGameWins: number; gameDraws: number } | null
}

function isLegacyMatch(match: unknown): match is LegacyMatch {
  return typeof match === 'object' && match !== null && 'aEntrantId' in match
}

function migrateMatch(legacy: LegacyMatch): Match {
  const entrantIds =
    legacy.bEntrantId === null ? [legacy.aEntrantId] : [legacy.aEntrantId, legacy.bEntrantId]

  let result: MatchResult | null = null
  if (legacy.result !== null) {
    const { aGameWins, bGameWins, gameDraws } = legacy.result
    // A bye's single entrant keeps only its own game wins; the old shape stored a
    // meaningless 0 for the absent opponent.
    result = {
      gameWins: legacy.bEntrantId === null ? [aGameWins] : [aGameWins, bGameWins],
      gameDraws,
    }
  }

  return { id: legacy.id, entrantIds, result }
}

/**
 * Upgrades a tournament saved before matches held a list of entrants.
 *
 * Worth the ~20 lines rather than versioning the key and dropping the old value: this
 * runs on a device that may be halfway through a real event, and "the app forgot your
 * tournament" is a far worse outcome at a table than at a desk. The shape is detected
 * per match rather than by a stored version number, since no version was ever written.
 */
function migrate(raw: Tournament | null): Tournament | null {
  if (raw === null) return null

  // Decided per match rather than once per tournament. A short-circuit for "no legacy
  // matches anywhere" would be marginally faster and would make the per-match
  // already-current branch unreachable -- untestable defensive code, on the one path
  // whose whole job is coping with data this version never wrote.
  return {
    ...raw,
    rounds: raw.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) => (isLegacyMatch(match) ? migrateMatch(match) : match)),
    })),
  }
}

export function loadTournament(): Tournament | null {
  return migrate(getJSON<Tournament | null>(TOURNAMENT_KEY, null))
}

export function saveTournament(tournament: Tournament): void {
  setJSON(TOURNAMENT_KEY, tournament)
}

export function clearTournament(): void {
  setJSON<Tournament | null>(TOURNAMENT_KEY, null)
}
