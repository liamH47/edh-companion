import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getItem,
  getJSON,
  resetStorageBackend,
  setItem,
  setJSON,
  setStorageBackend,
} from './storage'

describe('storage', () => {
  beforeEach(() => {
    resetStorageBackend()
  })

  it('round-trips a string through the default in-memory backend', () => {
    setItem('key', 'value')
    expect(getItem('key')).toBe('value')
  })

  it('is null for a key never written', () => {
    expect(getItem('missing')).toBeNull()
  })

  it('round-trips JSON', () => {
    setJSON('card', { id: 'blood-artist', count: 3 })
    expect(getJSON('card', null)).toEqual({ id: 'blood-artist', count: 3 })
  })

  it('falls back rather than throwing on unparseable JSON', () => {
    setItem('card', 'not json')
    expect(getJSON('card', 'fallback')).toBe('fallback')
  })

  it('falls back for a key never written', () => {
    expect(getJSON('missing', 'fallback')).toBe('fallback')
  })

  it('delegates to a host-registered backend', () => {
    // This is how the web hands over localStorage and React Native hands over MMKV.
    const entries = new Map<string, string>()
    const backend = {
      getItem: vi.fn((key: string) => entries.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => void entries.set(key, value)),
    }
    setStorageBackend(backend)

    setItem('key', 'value')
    expect(backend.setItem).toHaveBeenCalledWith('key', 'value')
    expect(getItem('key')).toBe('value')
    expect(backend.getItem).toHaveBeenCalledWith('key')
  })

  it('forgets everything when reset back to memory', () => {
    setItem('key', 'value')
    resetStorageBackend()
    expect(getItem('key')).toBeNull()
  })

  it('degrades to null rather than throwing when the backend read is denied', () => {
    // A sandboxed/partitioned iframe or locked-down webview throws on storage access.
    setStorageBackend({
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {},
    })
    expect(getItem('key')).toBeNull()
  })

  it('swallows a denied or quota-full write rather than crashing the caller', () => {
    setStorageBackend({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
    })
    expect(() => setItem('key', 'value')).not.toThrow()
    expect(() => setJSON('key', { a: 1 })).not.toThrow()
  })
})
