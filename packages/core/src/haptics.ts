/**
 * A short confirmation tap, behind a host-registered backend.
 *
 * The web has `navigator.vibrate`, React Native has expo-haptics, and neither is
 * reachable from platform-free code. Defaults to nothing, since a missing tap is
 * invisible while a crash is not.
 */
const silent = () => {}
let tap = silent

export function setHapticsBackend(next: () => void): void {
  tap = next
}

/** Back to doing nothing. For tests. */
export function resetHapticsBackend(): void {
  tap = silent
}

export function tapHaptic(): void {
  tap()
}
