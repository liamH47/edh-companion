const STORAGE_KEY = 'mtg-calc-theme'

export type Theme = 'light' | 'dark'

export function getInitialTheme(): Theme {
  // Runs in ThemeToggle's first-render useState initializer, before anything mounts.
  // Storage access can be denied outright (sandboxed/partitioned iframe, locked-down
  // webview); fall back to the system preference rather than throwing during render.
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY)
  } catch {
    stored = null
  }
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // The class toggle above already applied the theme for this session; only the
    // remembered-across-reloads part is lost, which is not worth crashing over.
  }
}
