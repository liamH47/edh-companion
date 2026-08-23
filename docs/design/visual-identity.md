# Visual identity and improvement audit

Status: **partially implemented** — see the checklist at the bottom for what has landed
and what is still queued. Written 2026-08-23, after the Comet/dungeon glow-up (PRs #37,
#39–#42) shipped card-first thumbnails, real 3D dice, and the dungeon map. This is the
follow-up pass the user asked for: an audit of "all the current functionalities and
aesthetics," done the same way the Comet/dungeon work was — find what looks unfinished,
then fix it.

## What this audit found

The bespoke content in this app is good: hand-drawn mana symbols, a projected 3D d6/d20
with zero dependencies, Krark's Thumb as an actual goblin fist, the dungeon room map. All
of it sits on **generic admin-panel chrome underneath it** — the two problems below are
why.

### 1. No typeface was ever chosen

`apps/web/src/index.css` sets no `font-family` anywhere. Every screen renders in
whatever system-UI font the visiting device defaults to — San Francisco on an iPhone,
Segoe UI on Windows, Roboto on Android. `docs/ui/design-tokens.md`'s type scale table
defines size, weight and letter-spacing for eight variants and is silent on family,
because there was never one to document.

### 2. The palette is Tailwind's own defaults, unmodified

`packages/core/src/theme/tokens.ts`'s `color.light`/`color.dark` are, hex for hex,
Tailwind's stock `slate` neutral scale plus `indigo-600` for the accent
(`#4f46e5`/`#818cf8`). Nothing about the ramp was chosen for this app — it is the
palette every unstyled Tailwind admin panel ships with, and the one the
`artifact-design` skill's own "avoid AI-generated design" list names as the generic
default to avoid. It is not connected to anything actually in the app: not the gold of
the coin (`#e0b64a`), not the ink-black of the mana glyph (`#241f20`), not Magic's own
five colors.

### 3. A real bug hiding inside the defaults: elevation is invisible in light mode

`surface` and `surfaceRaised` are **both `#ffffff`** in the light palette. Every place
that is supposed to read as "raised above the base panel" — `Sheet`, `CardDetailSheet`,
`SetupSheet`, `StatTile`, `HeroStat`'s compact tile, `Chip`, `ThemeToggle`'s hover state
— currently renders with zero visible lift in light mode. It only works today because
dark mode's two values (`#151d2e` vs `#1c2740`) happen to differ. This is a defect, not
a style preference, and it is fixed by the same token edit that gives the app a palette.

### 4. Three different "back" buttons

`CardScreen` uses a circular icon button (`ChevronLeftIcon` in a `Pressable`).
`PodsScreen`, `SwissScreen`, and `PodSetupScreen` each hand-roll `‹ Pairings` as text
inside a ghost `Button`. Same action, three different shapes, in an app that otherwise
enforces "zero per-card branching" as a design law.

### 5. The tab bar has no icons

`Icon.tsx` already carries `CardsIcon`, `SunIcon`, and `MoonIcon` — but `TabBar.tsx`
renders plain text labels for all four tabs, including Cards. The other three tabs (Coin
Flip, Pairings, Dice) have no icon at all. Every other nav-shaped control in the app
(header buttons, action bar) pairs an icon with its label; the tab bar is the one
exception, and it's the one place a user looks at on every single screen.

### 6. Everything from before the glow-up still reads as a form

`RoundScreen`'s match rows, `PodRoundScreen`'s pod rows, and `CoinFlip`'s toggle are
plain bordered boxes of text — functional, consistent with the pre-glow-up spec, but
visually flat next to `CardPickerScreen`'s thumbnail rows or `CardArtHero`'s card-and-
shield layout. They don't need card art (there's no card behind a Swiss match), but they
can carry the same "something to look at, not just read" quality other screens now have.

### What is *not* broken

Component structure, accessibility (48px targets, focus traps, aria-live regions,
reduced-motion handling), the portability boundary, and the schema-driven zero-branching
rule are all sound and don't need touching. This audit is about **surface**, not
architecture.

## The chosen identity

Two problems (no typeface, borrowed palette) plus one bug (invisible elevation) point at
one fix: replace the token file's contents, not its shape. Every component already reads
color and type through tokens — this is a two-file change that repaints the whole app.

### Typefaces: Fraunces + Sora

- **Fraunces** (display serif, weight 600) for `Text`'s `title` variant only — screen
  headers, sheet titles, "Round N of M." A soft, slightly old-style serif with real
  character (ink-trap details, warm curves) reads as "a ledger, not a dashboard" without
  imitating Magic's own proprietary typography (Beleren, Plantin) — which matters both
  for looking distinctive and for staying clearly separate from anything Wizards-branded,
  per the Fan Content Policy note already in `docs/roadmap.md`.
- **Sora** (geometric sans, weights 500/600/700) for everything else — body text, labels,
  stat tiles, and the hero numbers. It has genuine personality (slightly rounded
  terminals, a distinct `g`) without being one of the interchangeable "safe" faces
  (Inter, Space Grotesk) that show up on every unstyled AI-generated page. Weight 700
  carries the giant hero digits; the existing size ladder (`heroSm/Md/Lg`) is untouched.

**Both are self-hosted, not linked from Google Fonts' CDN**, for two reasons that both
already show up elsewhere in this repo: the app's whole pitch is that no tab needs a
connection (a CDN font request is a request), and self-hosted static files are what
actually ports to Expo — `expo-font`'s `useFonts()` loads bundled `.ttf`/`.otf` files,
not a `<link>` tag, so the same source files carry over to the native build with a
different loader instead of a rewrite. This is the same reasoning that ruled out
three.js for the dice and a Google Fonts `<link>` for icons — own the asset, don't
depend on a CDN being up. Both faces are OFL-licensed, which permits redistribution.
Only the Latin subset is bundled (the app is English-only today); four files, ~80KB
total.

### Palette: a warm ledger, not a cool dashboard

Named for what it evokes rather than a mood board: an illuminated manuscript's parchment
and ink in light mode, the same page by candlelight in dark mode. Every neutral gets a
warm (not blue-gray) cast, and the accent moves from generic indigo to a burnished
bronze/gold — which, unplanned but confirmed by inspection, is close to the gold already
used for the coin flip's `CoinBase` art (`#e0b64a`/`#a87c1f`) and close to the mana
glyph's ink (`#241f20`, almost identical to the new light `text` token). The identity was
sitting half-built in the bespoke components already; this makes the token file agree
with them.

| Token | Light | Dark | Changed from |
|---|---|---|---|
| `canvas` | `#f6f1e6` | `#17130e` | cool slate → warm parchment/ink |
| `surface` | `#fffdf7` | `#221b13` | pure white/navy → warm white/brown |
| `surfaceRaised` | `#f4e9d2` | `#2d2418` | **was identical to `surface` in light mode** |
| `border` | `#e2d5b8` | `#40331f` | cool gray → warm tan |
| `text` | `#241f1a` | `#f3ead9` | cool near-black/white → warm ink/parchment |
| `textMuted` | `#655a49` | `#b6a686` | cool gray → warm brown-gray |
| `accent` | `#8a4a12` | `#dba054` | indigo → bronze/gold |
| `accentText` | `#fff8ec` | `#241a0d` | unchanged role, warmed hue |
| `accentMuted` | `#f2e2c4` | `#3a2c16` | pale indigo → pale gold |
| `danger` | `#b3261e` | `#e88579` | pure red → warmed red |
| `overlay` | `rgba(36,31,26,.45)` | `rgba(10,8,5,.65)` | cool → warm-black |

`disabledSurface`/`disabledBorder`/`dangerSurface`/`dangerBorder`/`dangerText` shift the
same warm direction; full values are in `tokens.ts`, not repeated here. **Unchanged
deliberately**: `mana` and `manaGlyph` (already documented as non-theme-aware — Magic's
own colors, not this app's), and `diceShade.max` (an opacity ceiling, palette-independent
by construction).

Contrast was checked against WCAG 2.1 AA (4.5:1 for text) for every text/background pair
that changed, not just eyeballed:

| Pair | Ratio |
|---|---|
| light `text` / `canvas` | 14.5:1 |
| light `text` / `surface` | 16.1:1 |
| light `textMuted` / `canvas` | 5.99:1 |
| light `accent`-as-text / `surfaceRaised` | 5.68:1 |
| light `accentText` / `accent` fill | 6.48:1 |
| light `dangerText` / `dangerSurface` | 9.0:1 |
| dark `text` / `canvas` | 15.5:1 |
| dark `textMuted` / `canvas` | 7.74:1 |
| dark `accent`-as-text / `surfaceRaised` | 6.66:1 |
| dark `accentText` / `accent` fill | 7.46:1 |
| dark `dangerText` / `dangerSurface` | 11.2:1 |

The first draft's light `textMuted` (`#7d715c`) landed at 4.25:1 — just under AA. It was
darkened to `#655a49` to clear the bar; every other pair had headroom from the start.
`border` colors stay intentionally low-contrast against their surface (both the old and
new palettes are ~1.4:1) — they are decorative hairlines, not text or a required-contrast
UI boundary.

## Improvement backlog, in priority order

Each is scoped to land as its own PR, per this repo's normal size. **1–2 are one PR**
(they're the same token-file edit); the rest are independent.

1. **Ship the identity above** — `tokens.ts` (colors + a new `fontFamily` entry),
   `generateTokensCss.ts` emits `--font-display`/`--font-body` into the existing
   `@theme` block (Tailwind's own reserved `--font-*` namespace, so `font-display`
   becomes a real utility class — no tree-shaking risk, unlike the mana discs' runtime
   `var()` interpolation, because this usage is a static class name Tailwind's scanner
   sees), font files land in `apps/web/public/fonts/`, `@font-face` rules and a
   `body { font-family: var(--font-body) }` line go in `index.css`, `Text.tsx`'s `title`
   variant gains the `font-display` class. Fixes the elevation bug as a side effect of
   the same edit. Update `docs/ui/design-tokens.md`'s color table and add a Typography
   section naming the two faces.
2. *(folded into #1 above.)*
3. **Unify the back button.** Give `Pressable` + `ChevronLeftIcon` pattern from
   `CardScreen` a name — a small `BackButton` component in `apps/web/src/ui/` — and use
   it in `PodsScreen`, `SwissScreen`, `PodSetupScreen` in place of the `‹ Pairings` text
   button. One shape for one action, everywhere.
4. **Icons in the tab bar.** `CardsIcon` already exists; add hand-drawn `CoinIcon`,
   `UsersIcon` (Pairings), and `DiceIcon` to `Icon.tsx` in the same stroke-based style as
   the existing set, render icon-above-label in `TabBar.tsx`, tint the active tab with
   `accent` (already the pattern for the active label's color).
5. **Give Swiss/pods rows a visual anchor.** Not card art — there's no card behind a
   match — but an initial-letter badge (a small `accent`-tinted circle, first letter of
   the entrant's name) in `RoundScreen` and `PodRoundScreen`'s rows gives them the same
   "something to look at, not just read" quality the card picker's thumbnails give card
   rows, at the same generic, schema-free cost.
6. **PWA installability** — see `docs/mobile-port-roadmap.md`'s Phase 6.5. Distinct
   enough in scope (manifest, service worker, icon set, offline runtime caching of
   Scryfall images) to warrant its own document rather than repeating it here.

## What was deliberately left alone

- **Component structure and the zero-per-card-branching rule** — sound, not this audit's
  concern.
- **Hand-drawn art already in the app** (mana symbols, the coin, the dice) — it's good,
  and two of the three already preview the new palette by coincidence.
- **The five Magic colors (`mana` tokens) and `manaGlyph`** — correctly non-theme-aware
  by design; repainting them would make them *wrong*, not better.
- **Danger red's hue family** — warmed slightly for palette cohesion, but kept
  recognizably red. Alert semantics shouldn't be clever.

## Implementation checklist

- [x] Item 1 — identity rollout (tokens, fonts, docs) — #43
- [x] Item 3 — unified back button — #44
- [x] Item 4 — tab bar icons — #44
- [x] Item 5 — Swiss/pods row badges — #44
- [x] Item 6 — PWA (tracked in `docs/mobile-port-roadmap.md`)
