# Design tokens

Single source of truth: `packages/core/src/theme/tokens.ts` — a plain TS object, no React/DOM
imports, importable verbatim by a future React Native port. `npm run tokens:build` derives
`apps/web/src/theme/tokens.css` from it (Tailwind v4 `@theme` block); `npm run tokens:check`
fails CI if the committed CSS is stale. Never hand-edit `tokens.css`.

On web, color/radius/type tokens are available as Tailwind utilities (`bg-surface`, `rounded-md`,
`text-title`, ...). Spacing is the one category that is **not** — see "Spacing" below. In
component code, prefer the token utility over importing `tokens.ts` directly — reach for the raw
object only where a numeric value is required (inline `style`, JS math), e.g. `hitTarget.min`,
`motion.duration.sheet`.

## Color

Two full palettes, `color.light` and `color.dark` — "an illuminated ledger": warm
parchment and ink in light mode, the same page by candlelight in dark mode. `.dark` on
`<html>` (set by `src/core/theme.ts`) swaps every `--color-*` variable at once — no
component ever writes a `dark:` variant. Full rationale, the palette's relationship to
the coin/mana art already in the app, and a contrast-ratio table for every pair:
`docs/design/visual-identity.md`.

| Token | Utility | Light | Dark | Use for |
|---|---|---|---|---|
| `canvas` | `bg-canvas` | `#f6f1e6` | `#17130e` | Page background |
| `surface` | `bg-surface` | `#fffdf7` | `#221b13` | Base panels, cards |
| `surfaceRaised` | `bg-surface-raised` | `#f4e9d2` | `#2d2418` | Sheets, popovers — one step up |
| `border` | `border-border` | `#e2d5b8` | `#40331f` | Hairlines, panel borders |
| `text` | `text-text` | `#241f1a` | `#f3ead9` | Primary text |
| `textMuted` | `text-text-muted` | `#655a49` | `#b6a686` | Labels, secondary text |
| `accent` | `bg-accent` / `text-accent` | `#8a4a12` | `#dba054` | Primary actions, hero emphasis |
| `accentText` | `text-accent-text` | `#fff8ec` | `#241a0d` | Text/icons on an accent fill |
| `accentMuted` | `bg-accent-muted` | `#f2e2c4` | `#3a2c16` | Selected/hover tint of accent surfaces |
| `danger` | `text-danger` | `#b3261e` | `#e88579` | Alert text/icons |
| `dangerSurface` | `bg-danger-surface` | `#fbeae8` | `#2e1712` | Alert banner background |
| `dangerBorder` | `border-danger-border` | `#eec2bc` | `#6b2c22` | Alert banner border |
| `dangerText` | `text-danger-text` | `#7a1c15` | `#f6c8c0` | Alert banner text |
| `overlay` | `bg-overlay` | `rgba(36,31,26,.45)` | `rgba(10,8,5,.65)` | Sheet backdrop |
| `disabledSurface` | `bg-disabled-surface` | `#e9decb` | `#2d2418` | Disabled button fill |
| `disabledText` | `text-disabled-text` | `#a89b83` | `#6b5d45` | Disabled button/field text |

**Rule: one accent.** Bronze/gold (`accent`) is the only saturated color used for
interactive emphasis. `danger` is reserved for the loss-alert path (`AlertSpec`) — never
reuse it for ordinary destructive-but-safe actions like "New turn".

Two sanctioned exceptions, both for controls that destroy something a player cannot get
back: `TournamentSetupScreen`'s remove-entrant button (`text-danger`, so the destructive
one of three otherwise-identical circles reads apart), and `ConfirmSheet`'s confirm button.
The distinction the rule is really drawing is *reversible* versus not — "New turn" is
undone by playing on, a wiped tournament is not.

## Typography: two self-hosted faces

`fontFamily.display` (**Fraunces**, weight 600) and `fontFamily.body` (**Sora**, weights
500/600/700) in `tokens.ts` emit as `--font-display`/`--font-body` inside the `@theme`
block, which is Tailwind's own reserved namespace — they generate real `font-display`/
`font-body` utility classes, not just CSS variables. `body { font-family: var(--font-body)
}` in `index.css` sets Sora as the default for everything; `Text`'s `title` variant is
the only place `font-display` is added, so Fraunces appears exclusively on screen and
sheet headers.

Both are self-hosted `.woff2` files in `apps/web/public/fonts/`, loaded via `@font-face`
in `index.css` — not a Google Fonts `<link>`. Two reasons: the app's offline pitch means
no tab should need a font request either, and a bundled static file is what carries
unchanged into Expo's `useFonts()`, where a `<link>` tag has no equivalent at all. Latin
subset only, OFL-licensed. See `docs/design/visual-identity.md` for the full reasoning.

**Naming pitfall:** a color token named exactly like the utility prefix that consumes it
(originally `bg`, generating `bg-bg`) breaks Tailwind's production `@apply` resolution against a
separately-`@import`ed `@theme` file, even though the exact same class works fine used directly
in JSX and in dev. Renamed to `canvas` (`bg-canvas`). If you add a new color token, either avoid
`@apply`-ing it in `index.css`, or use `var(--color-<name>)` directly there instead (see the
`body` rule) — and don't name a token identically to its own prefix.

## Spacing

**Not a token category with generated CSS.** An earlier version emitted a named
`spacing.{xs,sm,md,lg,xl,xxl}` scale as `--spacing-*` theme vars, but Tailwind v4's spacing
scale backs far more than padding/gap — width, height, max-width, min-width, inset, translate,
and more all resolve through it. A custom `--spacing-xl` silently shadowed the *built-in*
`max-w-xl` (36rem) with the token's own 24px, breaking `Sheet`'s panel width and any
pre-existing use of `max-w-xs`/`max-w-xl` elsewhere (`CoinFlip.tsx`, `App.tsx`) that had nothing
to do with this design system. `tokens.ts` keeps a plain `spacing` object for reference/RN use,
but no CSS is generated from it. On web, use Tailwind's stock numeric scale directly — it's
already the same values, since they're exact multiples of the default 4px unit:

| Intent | Numeric utility | Value |
|---|---|---|
| xs | `-1` (e.g. `gap-1`, `p-1`) | 4px |
| sm | `-2` | 8px |
| md | `-3` | 12px |
| lg | `-4` | 16px (default panel padding) |
| xl | `-6` | 24px (between major screen sections) |
| xxl | `-8` | 32px |

## Radius

`radius.{sm,md,lg,pill}` → `8/16/24/999px`, utilities `rounded-*`. `pill` for every button and
chip; `lg` for sheets and the card screen's outer panel; `md` for stat tiles; `sm` rarely (small
inline badges only).

## Type scale

`typeScale.*` sizes feed `--text-*` (font-size only, in rem). Weight/letter-spacing are **not**
in the generated CSS — they're hardcoded per variant in the `Text` primitive (see
`component-spec.md#Text`) using Tailwind's own weight utilities, so this table is normative:

| Variant | Size | Weight | Tracking | Use for |
|---|---|---|---|---|
| `label` | 11px | 600 | 0.06em, uppercase | Field labels, chip captions |
| `body` | 14px | 500 | normal | Default text, help text |
| `bodyStrong` | 15px | 600 | normal | Emphasized inline text |
| `title` | 18px | 600 | normal | Screen/sheet titles |
| `statTile` | 20px | 700 | normal | Non-hero stat tile values, stepper value |
| `heroSm` | 36px | 700 | normal | Hero number, ≥7 digits |
| `heroMd` | 48px | 700 | normal | Hero number, 5–6 digits |
| `heroLg` | 64px | 700 | normal | Hero number, ≤4 digits |

Every `Text` render is `font-variant-numeric: tabular-nums` — digits never reflow the layout
when a value changes.

## Hit targets & motion

Not emitted as CSS — consumed directly from `tokens.ts` in component code, since they drive
either an inline numeric style or JS timing, not a Tailwind class:

- `hitTarget.min = 48` (px). Every tap target (buttons, stepper controls, chips with `onClick`,
  toggle segments) is `min-h-12 min-w-12` or larger. Non-negotiable per
  `portability-rules.md`'s a11y note.
- `motion.duration.{fast,base,sheet} = 160/200/280` (ms); `motion.easing.{standard,decelerate,accelerate}`
  are cubic-bezier strings. `src/core/motion.ts` exports `transitionDuration(token)`, which
  returns `0` under `prefers-reduced-motion: reduce` instead of a shortened duration — reduced
  motion means *no* motion here, not less of it.
  - `accelerate` speeds up *into* the end of a movement, which is only correct for something
    falling — the die's descent between bounces. On a UI transition it makes the interface feel
    like it is getting away from you; use `standard` or `decelerate` for anything a person
    initiates.
- **The one exception is an outcome-reveal animation** — the coin flip and the die roll —
  exported as `revealDuration()` (`REVEAL_DURATION_MS`/`REDUCED_REVEAL_DURATION_MS`). Here the
  animation *is* the result being shown, so at `0` the answer would just appear with no sense a
  flip or roll happened, which reads as a bug rather than an accessibility win. Under reduced
  motion it *shortens* (900 → 150ms) rather than collapsing. Use `revealDuration()`, not a
  hardcoded pair, for any future roll/flip so the exception stays in one place.
