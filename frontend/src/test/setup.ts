import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// jsdom doesn't implement localStorage; ThemeToggle needs it to persist the chosen theme.
if (!window.localStorage) {
  const store = new Map<string, string>()
  window.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }
}

// jsdom doesn't implement matchMedia; ThemeToggle needs it to read the system preference.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

afterEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})
