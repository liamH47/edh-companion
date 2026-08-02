/**
 * Key/value storage, behind a backend the host app registers at startup.
 *
 * The API is deliberately **synchronous**, because three callers read during render --
 * `useTournament`'s lazy useState, `useCardSession`'s setup check, and the initial
 * route decision. Making it async would push all three into an effect plus a loading
 * state, which is both more code and a worse experience (a frame where the tournament
 * looks empty). On React Native that means MMKV rather than AsyncStorage.
 *
 * A settable module-level singleton rather than React context: callers include plain
 * module-level functions that a context cannot reach. The default is in-memory, so a
 * host that registers nothing still works -- it just forgets on reload, which is also
 * what makes this safe by default in tests.
 */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function memoryStore(): KeyValueStore {
  const entries = new Map<string, string>()
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
  }
}

let backend: KeyValueStore = memoryStore()

export function setStorageBackend(next: KeyValueStore): void {
  backend = next
}

/** Resets to a fresh in-memory store. For tests. */
export function resetStorageBackend(): void {
  backend = memoryStore()
}

export function getItem(key: string): string | null {
  return backend.getItem(key)
}

export function setItem(key: string, value: string): void {
  backend.setItem(key, value)
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
