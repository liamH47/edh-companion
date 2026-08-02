import { getJSON, setJSON } from '../storage'
import type { Tournament } from './types'

const TOURNAMENT_KEY = 'mtg-calc-tournament'

/**
 * One active tournament at a time, held on the device. Nothing about a tournament
 * goes to the server -- pairing and standings are pure functions in this directory --
 * so a draft keeps working through a dead connection.
 */
export function loadTournament(): Tournament | null {
  return getJSON<Tournament | null>(TOURNAMENT_KEY, null)
}

export function saveTournament(tournament: Tournament): void {
  setJSON(TOURNAMENT_KEY, tournament)
}

export function clearTournament(): void {
  setJSON<Tournament | null>(TOURNAMENT_KEY, null)
}
