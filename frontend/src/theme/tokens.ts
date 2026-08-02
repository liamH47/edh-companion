/**
 * Single source of truth for the design system: plain data, no React/DOM imports.
 * `scripts/gen-tokens.mjs` reads this file directly (Node's native TS support) and
 * emits `tokens.css` as CSS custom properties for the web build. A future React
 * Native port imports these same objects and never touches the generated CSS.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const

export const hitTarget = {
  min: 48,
} as const

export const motion = {
  duration: {
    fast: 160,
    base: 200,
    sheet: 280,
  },
  easing: {
    standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  },
} as const

export const typeScale = {
  label: { size: 11, weight: 600, letterSpacing: 0.06 },
  body: { size: 14, weight: 500, letterSpacing: 0 },
  bodyStrong: { size: 15, weight: 600, letterSpacing: 0 },
  title: { size: 18, weight: 600, letterSpacing: 0 },
  statTile: { size: 20, weight: 700, letterSpacing: 0 },
  // Hero size steps by digit count -- see cardModel.heroFontSize().
  heroSm: { size: 36, weight: 700, letterSpacing: 0 },
  heroMd: { size: 48, weight: 700, letterSpacing: 0 },
  heroLg: { size: 64, weight: 700, letterSpacing: 0 },
} as const

export interface ColorTokens {
  canvas: string
  surface: string
  surfaceRaised: string
  border: string
  text: string
  textMuted: string
  accent: string
  accentText: string
  accentMuted: string
  danger: string
  dangerSurface: string
  dangerBorder: string
  dangerText: string
  overlay: string
  disabledSurface: string
  disabledText: string
}

export const color: { light: ColorTokens; dark: ColorTokens } = {
  light: {
    canvas: '#f8fafc',
    surface: '#ffffff',
    surfaceRaised: '#ffffff',
    border: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#64748b',
    accent: '#4f46e5',
    accentText: '#ffffff',
    accentMuted: '#eef2ff',
    danger: '#dc2626',
    dangerSurface: '#fef2f2',
    dangerBorder: '#fecaca',
    dangerText: '#991b1b',
    overlay: 'rgba(15, 23, 42, 0.4)',
    disabledSurface: '#e2e8f0',
    disabledText: '#94a3b8',
  },
  dark: {
    canvas: '#0b1120',
    surface: '#151d2e',
    surfaceRaised: '#1c2740',
    border: '#293349',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    accent: '#818cf8',
    accentText: '#0b1120',
    accentMuted: '#1e2547',
    danger: '#f87171',
    dangerSurface: '#2a1315',
    dangerBorder: '#7f1d1d',
    dangerText: '#fecaca',
    overlay: 'rgba(2, 6, 23, 0.6)',
    disabledSurface: '#1c2740',
    disabledText: '#475569',
  },
}
