import type { ReactElement } from 'react'
import type { ManaColor } from '@mtg/core/theme/tokens'

interface ManaSymbolProps {
  color: ManaColor
  /** Pixel size of the disc. */
  size?: number
  /** Dimmed when this color is not in the pool, so a glance finds what you have. */
  dimmed?: boolean
}

/**
 * One mana symbol: the pale disc with its glyph, drawn by hand.
 *
 * Hand-written SVG because the portability rules require it -- these have to survive the
 * move to `react-native-svg`, where an icon font or a sprite sheet would not. The glyphs
 * are deliberately simplified rather than traced from the printed symbols: at 22px on a
 * phone the silhouette is all that reads, and a faithful skull becomes mud.
 *
 * `fill` comes from the mana tokens as literal props (not Tailwind `fill-*` classes),
 * which is the pattern `Die3D` established for the same portability reason.
 */
const GLYPHS: Record<ManaColor, ReactElement> = {
  // Sun: a disc with eight triangular rays.
  W: (
    <>
      <circle cx="12" cy="12" r="4.1" />
      <path d="M12 2.6l1.45 3.1h-2.9zM12 21.4l-1.45-3.1h2.9zM2.6 12l3.1-1.45v2.9zM21.4 12l-3.1 1.45v-2.9zM5.35 5.35l3.3 1.05-2.25 2.25zM18.65 18.65l-3.3-1.05 2.25-2.25zM18.65 5.35l-1.05 3.3-2.25-2.25zM5.35 18.65l1.05-3.3 2.25 2.25z" />
    </>
  ),
  // Water drop.
  U: <path d="M12 3.1c3.3 3.9 5.9 6.9 5.9 9.6a5.9 5.9 0 0 1-11.8 0c0-2.7 2.6-5.7 5.9-9.6z" />,
  // Skull: cranium and jaw, with the sockets cut out by the even-odd rule so the disc
  // shows through rather than being painted over in a second colour.
  B: (
    <path
      fillRule="evenodd"
      d="M12 3.4c-3.8 0-6.7 2.7-6.7 6.2 0 2 .9 3.6 2.2 4.7v2.3c0 .8.6 1.4 1.4 1.4h6.2c.8 0 1.4-.6 1.4-1.4v-2.3c1.3-1.1 2.2-2.7 2.2-4.7 0-3.5-2.9-6.2-6.7-6.2zm-3 5.6a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zm6 0a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zm-3 4.6-1.1 2.2h2.2z"
    />
  ),
  // Flame.
  R: (
    <path d="M13 2.6c.5 2.8-1 4.2-2.4 5.8-1.4 1.6-2.4 3.2-2.4 5.3a5.9 5.9 0 0 0 11.8 0c0-2.5-1.3-4.2-2.8-5.9-.4 1-1 1.7-1.8 2 .3-2.6-1-5.1-2.4-7.2z" />
  ),
  // Conifer.
  G: <path d="M12 3.1 6.4 12h3.3l-4 6.1h5.2v2.8h2.2v-2.8h5.2l-4-6.1h3.3z" />,
  // Generic/colorless: a plain faceted diamond.
  C: <path d="M12 3.2 18.8 12 12 20.8 5.2 12z" />,
}

export function ManaSymbol({ color, size = 40, dimmed = false }: ManaSymbolProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={dimmed ? { opacity: 0.35 } : undefined}
    >
      <circle cx="12" cy="12" r="11.4" fill={`var(--mana-${color.toLowerCase()})`} />
      <g fill="var(--mana-glyph)">{GLYPHS[color]}</g>
    </svg>
  )
}
