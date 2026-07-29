import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

function mockPrefersDark(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
}

describe('ThemeToggle', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to light mode when nothing is stored and the system prefers light', () => {
    mockPrefersDark(false)
    render(<ThemeToggle />)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument()
  })

  it('defaults to dark mode when nothing is stored and the system prefers dark', () => {
    mockPrefersDark(true)
    render(<ThemeToggle />)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
  })

  it('uses a stored light preference over a dark system preference', () => {
    mockPrefersDark(true)
    localStorage.setItem('mtg-calc-theme', 'light')
    render(<ThemeToggle />)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('uses a stored dark preference over a light system preference', () => {
    mockPrefersDark(false)
    localStorage.setItem('mtg-calc-theme', 'dark')
    render(<ThemeToggle />)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('toggles the theme and persists the choice on click', async () => {
    mockPrefersDark(false)
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('mtg-calc-theme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('mtg-calc-theme')).toBe('light')
  })
})
