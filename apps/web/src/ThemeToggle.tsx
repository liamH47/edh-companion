import { useEffect, useState } from 'react'
import { applyTheme, getInitialTheme, type Theme } from './theme'
import { MoonIcon, SunIcon } from './ui/Icon'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="min-h-12 min-w-12 rounded-full border border-border text-text-muted hover:bg-surface-raised hover:text-text"
    >
      {isDark ? <SunIcon className="mx-auto" /> : <MoonIcon className="mx-auto" />}
    </button>
  )
}
