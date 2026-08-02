/**
 * Thin key/value wrapper over localStorage -- the one storage API this app uses. Every
 * caller goes through here (not `window.localStorage` directly) so a React Native port
 * swaps this single file for an AsyncStorage-backed implementation and nothing else
 * changes. Reads/writes are synchronous on web; callers should treat them as if they
 * might not be (no assumptions about ordering across keys).
 */

export function getItem(key: string): string | null {
  return localStorage.getItem(key)
}

export function setItem(key: string, value: string): void {
  localStorage.setItem(key, value)
}

export function getJSON<T>(key: string, fallback: T): T {
  const raw = getItem(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setJSON<T>(key: string, value: T): void {
  setItem(key, JSON.stringify(value))
}
