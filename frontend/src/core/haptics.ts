/**
 * Tap feedback for counter/stepper buttons. `navigator.vibrate` is the web
 * implementation (works on Android Chrome, including Pixel; iOS Safari and desktop
 * browsers simply don't have the API, so the guard below makes this a silent no-op
 * there). An RN port swaps this one file for `expo-haptics`.
 */
export function tapHaptic(): void {
  navigator.vibrate?.(10)
}
