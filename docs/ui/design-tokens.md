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

Two full palettes, `color.light` and `color.dark`. `.dark` on `<html>` (set by
`src/core/theme.ts`) swaps every `--color-*` variable at once — no component ever writes a
`dark:` variant.

| Token | Utility | Light | Dark | Use for |
|---|---|---|---|---|
| `canvas` | `bg-canvas` | `#f8fafc` | `#0b1120` | Page background |
| `surface` | `bg-surface` | `#ffffff` | `#151d2e` | Base panels, cards |
| `surfaceRaised` | `bg-surface-raised` | `#ffffff` | `#1c2740` | Sheets, popovers — one step up |
| `border` | `border-border` | `#e2e8f0` | `#293349` | Hairlines, panel borders |
| `text` | `text-text` | `#0f172a` | `#f1f5f9` | Primary text |
| `textMuted` | `text-text-muted` | `#64748b` | `#94a3b8` | Labels, secondary text |
| `accent` | `bg-accent` / `text-accent` | `#4f46e5` | `#818cf8` | Primary actions, hero emphasis |
| `accentText` | `text-accent-text` | `#ffffff` | `#0b1120` | Text/icons on an accent fill |
| `accentMuted` | `bg-accent-muted` | `#eef2ff` | `#1e2547` | Selected/hover tint of accent surfaces |
| `danger` | `text-danger` | `#dc2626` | `#f87171` | Alert text/icons |
| `dangerSurface` | `bg-danger-surface` | `#fef2f2` | `#2a1315` | Alert banner background |
| `dangerBorder` | `border-danger-border` | `#fecaca` | `#7f1d1d` | Alert banner border |
| `dangerText` | `text-danger-text` | `#991b1b` | `#fecaca` | Alert banner text |
| `overlay` | `bg-overlay` | `rgba(15,23,42,.4)` | `rgba(2,6,23,.6)` | Sheet backdrop |
| `disabledSurface` | `bg-disabled-surface` | `#e2e8f0` | `#1c2740` | Disabled button fill |
| `disabledText` | `text-disabled-text` | `#94a3b8` | `#475569` | Disabled button/field text |

**Rule: one accent.** Indigo (`accent`) is the only saturated color used for interactive
emphasis. `danger` is reserved for the loss-alert path (`AlertSpec`) — never reuse it for
ordinary destructive-but-safe actions like "New turn".

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
- `motion.duration.{fast,base,sheet} = 160/200/280` (ms); `motion.easing.{standard,decelerate}`
  are cubic-bezier strings. `src/core/motion.ts` exports `transitionDuration(token)`, which
  returns `0` under `prefers-reduced-motion: reduce` instead of a shortened duration — reduced
  motion means *no* motion here, not less of it.
- **The one exception is an outcome-reveal animation** — the coin flip and the die roll —
  exported as `revealDuration()` (`REVEAL_DURATION_MS`/`REDUCED_REVEAL_DURATION_MS`). Here the
  animation *is* the result being shown, so at `0` the answer would just appear with no sense a
  flip or roll happened, which reads as a bug rather than an accessibility win. Under reduced
  motion it *shortens* (900 → 150ms) rather than collapsing. Use `revealDuration()`, not a
  hardcoded pair, for any future roll/flip so the exception stays in one place.
