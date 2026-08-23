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
    // Speeds up into the end of the movement. Only correct for something falling: the
    // die's descent between bounces. Using it on a UI transition makes the interface
    // feel like it is getting away from you, which is why the other two exist.
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const

/**
 * 3D die shading. Not emitted as CSS -- consumed by dice3d/shade.ts, which lays shadow
 * ink (the theme's text color at low opacity) over the token face color in proportion
 * to how far each face turns from the light. `max` is the fully-shadowed ceiling; the
 * lit face gets 0. One knob, so light and dark themes dim by the same fraction.
 */
export const diceShade = {
  max: 0.34,
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

/** The five colors of Magic, plus colorless. One value each, deliberately **not**
 * theme-aware: these are the game's own identity and a player reads them by hue, so a
 * "dark mode green" would be a different colour rather than a darker one. Each is the
 * pale disc a printed mana symbol sits on, chosen so `manaGlyph` stays legible on it
 * against either canvas. Tokens rather than raw hex in the component, for the same
 * reason `diceShade` is: nothing about the design system should live only in JSX. */
export const mana = {
  W: '#fbf8e4',
  U: '#a5d8f2',
  B: '#c7bfbb',
  R: '#f7a58c',
  G: '#9ccfae',
  C: '#d9d4cf',
} as const

export type ManaColor = keyof typeof mana

/** The symbol drawn on a mana disc. Near-black rather than pure, so it reads as ink on
 * a card rather than a UI stroke. */
export const manaGlyph = '#241f20'

/**
 * The two typefaces, self-hosted (see `apps/web/src/index.css`'s `@font-face` rules and
 * `docs/design/visual-identity.md`) rather than linked from Google Fonts' CDN: the app's
 * whole pitch is that no tab needs a connection, and a bundled static file is what
 * ports to Expo's `useFonts()` unchanged, where a `<link>` tag has no equivalent at all.
 * `display` is used once, for `Text`'s `title` variant only -- a serif for screen and
 * sheet headers reads as "a ledger," not a dashboard, without imitating Magic's own
 * proprietary type (Beleren, Plantin). `body` carries everything else, including the
 * hero numbers, at the weights already in the type scale (500/600/700 -- no new weight
 * steps were added, only a family).
 */
export const fontFamily = {
  display: "'Fraunces', ui-serif, Georgia, 'Times New Roman', serif",
  body: "'Sora', ui-sans-serif, system-ui, -apple-system, sans-serif",
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

/**
 * "An illuminated ledger" -- parchment and ink in light mode, the same page by
 * candlelight in dark mode. Every neutral carries a warm cast rather than the cool
 * blue-gray of an unstyled admin panel, and the accent is a burnished bronze/gold
 * rather than generic indigo -- chosen after noticing it was already half-built:
 * `CoinBase`'s hand-drawn coin (`#e0b64a`/`#a87c1f`, in `CoinFlip.tsx`) and the mana
 * glyph ink (`manaGlyph`, `#241f20`, almost exactly this palette's light `text`) were
 * already living in this hue family before the token file caught up to them. Full
 * rationale and the contrast-ratio table for every changed pair: `docs/design/visual-identity.md`.
 */
export const color: { light: ColorTokens; dark: ColorTokens } = {
  light: {
    canvas: '#f6f1e6',
    surface: '#fffdf7',
    // Deliberately distinct from `surface` -- the previous palette had both at
    // `#ffffff`, so every "raised" panel (Sheet, StatTile, Chip) had no visible lift
    // in light mode. This is the fix, not just a repaint.
    surfaceRaised: '#f4e9d2',
    border: '#e2d5b8',
    text: '#241f1a',
    textMuted: '#655a49',
    accent: '#8a4a12',
    accentText: '#fff8ec',
    accentMuted: '#f2e2c4',
    danger: '#b3261e',
    dangerSurface: '#fbeae8',
    dangerBorder: '#eec2bc',
    dangerText: '#7a1c15',
    overlay: 'rgba(36, 31, 26, 0.45)',
    disabledSurface: '#e9decb',
    disabledText: '#a89b83',
  },
  dark: {
    canvas: '#17130e',
    surface: '#221b13',
    surfaceRaised: '#2d2418',
    border: '#40331f',
    text: '#f3ead9',
    textMuted: '#b6a686',
    accent: '#dba054',
    accentText: '#241a0d',
    accentMuted: '#3a2c16',
    danger: '#e88579',
    dangerSurface: '#2e1712',
    dangerBorder: '#6b2c22',
    dangerText: '#f6c8c0',
    overlay: 'rgba(10, 8, 5, 0.65)',
    disabledSurface: '#2d2418',
    disabledText: '#6b5d45',
  },
}
