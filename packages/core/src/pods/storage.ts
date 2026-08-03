import { getJSON, setJSON } from '../storage'
import type { PodSession } from './types'

const POD_SESSION_KEY = 'mtg-calc-pod-session'

/**
 * One casual pod session at a time, held on the device. Nothing here goes to the
 * server -- generation is a pure function in this directory -- so a meetup keeps working
 * through a dead connection, and a mid-night reload keeps the pods it had.
 */
export function loadPodSession(): PodSession | null {
  return getJSON<PodSession | null>(POD_SESSION_KEY, null)
}

export function savePodSession(session: PodSession): void {
  setJSON(POD_SESSION_KEY, session)
}

export function clearPodSession(): void {
  setJSON<PodSession | null>(POD_SESSION_KEY, null)
}
