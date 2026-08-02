import { afterEach, describe, expect, it } from 'vitest'
import { getItem, getJSON, setItem, setJSON } from './storage'

afterEach(() => {
  localStorage.clear()
})

describe('getItem / setItem', () => {
  it('round-trips a plain string', () => {
    setItem('key', 'value')
    expect(getItem('key')).toBe('value')
  })

  it('returns null for a missing key', () => {
    expect(getItem('missing')).toBeNull()
  })
})

describe('getJSON / setJSON', () => {
  it('round-trips a JSON-serializable value', () => {
    setJSON('key', { a: 1, b: [2, 3] })
    expect(getJSON('key', null)).toEqual({ a: 1, b: [2, 3] })
  })

  it('returns the fallback for a missing key', () => {
    expect(getJSON('missing', 'fallback')).toBe('fallback')
  })

  it('returns the fallback when the stored value is not valid JSON', () => {
    setItem('key', 'not json')
    expect(getJSON('key', 'fallback')).toBe('fallback')
  })
})
