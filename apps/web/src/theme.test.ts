import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, getInitialTheme } from './theme'

const STORAGE_KEY = 'mtg-calc-theme'

afterEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  vi.restoreAllMocks()
})

describe('theme', () => {
  it('reads a saved theme', () => {
    localStorage.setItem(STORAGE_KEY, 'dark')
    expect(getInitialTheme()).toBe('dark')
  })

  it('falls back to the system preference when nothing is saved', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    expect(getInitialTheme()).toBe('dark')
  })

  it('falls back to the system preference when storage access throws', () => {
    // Spy the instance, not Storage.prototype: Node >= 26 ships its own global Storage
    // class, so in that environment `Storage.prototype` is Node's, not jsdom's, and a
    // prototype spy silently misses window.localStorage. An own-property spy on the
    // object under test intercepts on every Node version.
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied')
    })
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
    expect(getInitialTheme()).toBe('light')
  })

  it('applies the theme to the document and persists it', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
  })

  it('still applies the theme when persisting throws', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded')
    })
    expect(() => applyTheme('dark')).not.toThrow()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
