import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, getInitialTheme } from './theme'

const STORAGE_KEY = 'mtg-calc-theme'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  vi.restoreAllMocks()
})

/** A localStorage whose chosen methods throw, swapped in whole via vi.stubGlobal.
 *
 * Not a spy: which object the bare `localStorage` in theme.ts resolves to differs by
 * Node version (Node >= 26 ships its own global Storage; older Nodes get jsdom's
 * proxy-backed one), and each of those defeats a different spying strategy -- a
 * prototype spy misses one, an instance spy misses the other. Replacing the global
 * intercepts on every environment, which the coverage gate proves: the catch branches
 * in theme.ts stay at 100% on both the local machine and CI.
 */
function stubThrowingStorage(methods: { getItem?: boolean; setItem?: boolean }) {
  vi.stubGlobal('localStorage', {
    getItem: methods.getItem
      ? () => {
          throw new DOMException('denied')
        }
      : () => null,
    setItem: methods.setItem
      ? () => {
          throw new DOMException('quota exceeded')
        }
      : () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  })
}

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
    stubThrowingStorage({ getItem: true })
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
    expect(getInitialTheme()).toBe('light')
  })

  it('applies the theme to the document and persists it', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
  })

  it('still applies the theme when persisting throws', () => {
    stubThrowingStorage({ setItem: true })
    expect(() => applyTheme('dark')).not.toThrow()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
