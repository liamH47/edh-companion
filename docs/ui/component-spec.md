# Component spec

Each section is self-contained — hand a single section to a model building that one component.
Every component lives at `apps/web/src/ui/<Name>.tsx` (primitives) or
`apps/web/src/cards/<Name>.tsx` (domain), with a co-located `<Name>.test.tsx` covering every
prop value and branch (this repo's Vitest config enforces 100% line/branch/function coverage —
see `apps/web/vite.config.ts`).

Read `design-tokens.md` and `portability-rules.md` first. Every value below (color, spacing,
radius, type, hit target, motion) refers to a token from `design-tokens.md`, not a raw number.

---

## Primitives (`src/ui/`) — built, Phase 1

### Surface

Flat panel: a bordered, tinted background at one of two elevation levels.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `level` | `'base' \| 'raised'` | `'base'` | `base` = `bg-surface`; `raised` = `bg-surface-raised` (one step up, e.g. a sheet inside a screen) |
| `radius` | `'sm' \| 'md' \| 'lg'` | `'md'` | |
| `tone` | `'default' \| 'danger'` | `'default'` | `danger` swaps in `bg-danger-surface`/`border-danger-border`, replacing the `level` classes — the shape every alert banner needs, so they compose this rather than hand-rolling a div |
| `padded` | `boolean` | `true` | Applies `p-4` (16px) when true |
| `role` | `string` | — | ARIA role passthrough, e.g. `alert` for a danger banner; maps to `accessibilityRole` in RN |
| `className` | `string` | `''` | Appended after the generated classes (can override) |
| `children` | `ReactNode` | — | |

RN notes: becomes a `View` with a `level`→style lookup identical in shape.

### Text

Typography primitive: one of eight fixed size/weight steps from `typeScale`. Always
`tabular-nums`. Forwards unrecognized props (`id`, `aria-*`, ...) to the rendered element —
required for e.g. `Sheet`'s `aria-labelledby` wiring.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `TextVariant` (8 values, see design-tokens.md) | `'body'` | |
| `color` | `'default' \| 'muted' \| 'accent' \| 'danger'` | `'default'` | |
| `as` | `ElementType` | `'span'` | Use `h1`/`h2` for real headings (screen title, sheet title) |
| `className`, `children`, `...rest` | | | |

RN notes: becomes RN's `Text`; `as` has no RN equivalent and is dropped (semantic heading level
isn't a native concept there — use `accessibilityRole="header"` instead).

### Button

Pill action button, always ≥48px tall regardless of size (`hitTarget.min`).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost'` | `'primary'` | `primary` = filled accent (the one confident focal action per screen); `secondary` = outlined; `ghost` = text-only |
| `size` | `'md' \| 'lg'` | `'md'` | `lg` = wider padding + heavier text, for the thumb-zone action bar |
| `fullWidth` | `boolean` | `false` | |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | This app has no real form submission |
| `disabled`, `onClick`, `...rest` (native `<button>` props) | | | |

States: default / hover (`hover:opacity-90` on primary) / `active:scale-[0.97]` press feedback
(disabled under `motion-reduce`) / `disabled` (`disabled-surface`/`disabled-text`, no press
feedback).

RN notes: becomes `Pressable` + `Text`; `active:scale` becomes an `Animated.Value` driven by
`onPressIn`/`onPressOut`.

### Pressable

Unstyled-by-default interactive wrapper (a `<button>` with press feedback, no visual opinion) —
what `Stepper`, `Toggle`, `Chip`, and `Sheet`'s close button are built from. Same native
`<button>` props as `Button`, minus `variant`/`size`/`fullWidth`.

RN notes: this one maps almost 1:1 onto RN's actual `Pressable` component — same name,
same purpose.

### Stepper

A `−` / value / `+` row for a bounded numeric input: two step buttons around a real,
directly-editable `<input type="number">`. Backs every non-boolean, non-select `FieldControl`
(setup numbers and live counters alike) — values like `starting_life` range 0–99999, so
tap-only stepping isn't usable; direct entry is required, not an enhancement.

| Prop | Type | Default |
|---|---|---|
| `value` | `number` | — |
| `onChange` | `(value: number) => void` | — |
| `label` | `string` | — (`aria-label` on the group and the input; "Decrease {label}" / "Increase {label}" on the buttons) |
| `min`, `max` | `number \| undefined` | `undefined` |
| `step` | `number` | `1` |

Behavior: decrement disabled when `value <= min`; increment disabled when `value >= max`; every
change (button tap or typed input) is clamped to `[min, max]` and truncated to an integer. An
empty input is ignored rather than committed as `NaN`. Both buttons are 48×48px circles;
`role="group"` wraps with `aria-label={label}`. No grouping-separator formatting here — native
`type="number"` inputs reject non-digit characters, so `formatNumber` is reserved for read-only
displays (`HeroStat`, `StatTile`).

RN notes: buttons via `Pressable`; the input becomes RN's `TextInput` with
`keyboardType="number-pad"` — a direct equivalent, not a rewrite.

### Toggle

Two-way segmented control for boolean fields — replaces a checkbox with a pattern RN can
express directly (two `Pressable`s in a row), and reads better at a glance across a table.

| Prop | Type | Default |
|---|---|---|
| `value` | `boolean` | — |
| `onChange` | `(value: boolean) => void` | — |
| `label` | `string` | — (`role="group"` aria-label) |
| `trueLabel`, `falseLabel` | `string` | `'Yes'`, `'No'` |

`true` renders on the left. Selected segment: `bg-accent text-accent-text`. Both segments carry
`aria-pressed`.

### SegmentedControl

Single choice among **three or more** options, rendered as a `role="radiogroup"` of pill
segments (`role="radio"` + `aria-checked`). Lives in `src/ui/` rather than a screen because
three features use the shape (the Swiss event-format selector, the Swiss match-length row, and
the Dice mode selector) — the `StatTile` precedent for extracting at the third use. Keep
`Toggle` for genuinely two-way boolean choices.

| Prop | Type | Default |
|---|---|---|
| `options` | `SegmentedOption<T>[]` (`{ value: T; label: string }`) | — |
| `value` | `T` | — |
| `onChange` | `(value: T) => void` | — |
| `label` | `string` | — (`role="radiogroup"` aria-label) |
| `disabled` | `boolean` | `false` |
| `itemBasis` | `string` | `'calc(50% - 0.25rem)'` — two-column wrap; pass `'0'` for one equal row |

Selected segment: `border-accent bg-accent text-accent-text`. `itemBasis` is an inline
`flex-basis` (not a Tailwind `basis-[...]` class) so it can vary at runtime without the JIT
missing it. RN notes: the radiogroup wrapper becomes a `View`; each segment is a `Pressable`
with `accessibilityRole="radio"`.

### Chip

Small pill for compact facts (a setup-summary segment, a future card-category tag). Renders as
a plain `<span>` unless `onClick` is given, in which case it becomes a 48px-tall tap target.

| Prop | Type |
|---|---|
| `children` | `ReactNode` |
| `onClick` | `(() => void) \| undefined` |
| `className` | `string` |

### Sheet

Bottom sheet: overlay + panel sliding up from the bottom edge, drag-handle affordance, focus
management, three ways to close.

| Prop | Type |
|---|---|
| `open` | `boolean` |
| `onClose` | `() => void` |
| `title` | `string` |
| `children` | `ReactNode` |

Behavior:
- Closes on backdrop click, `Escape`, or the header close button — all three call `onClose`;
  the caller decides what closing means (`SetupSheet`'s "Done" also marks setup confirmed).
- On open: focus moves to the panel (`role="dialog"`, `aria-modal`, `aria-labelledby` the
  title). On close: focus returns to whatever was focused before opening.
- Renders `null` when `open` is false — no hidden-but-mounted DOM.
- Transition duration comes from `transitionDuration('sheet')` (280ms, or 0 under reduced
  motion); easing from `motion.easing.standard`/`decelerate`.
- Not portalled: every current usage sits at the screen root already, and portals have no RN
  analogue — the RN rewrite uses a native modal API instead, so this stays simple on web.

RN notes: this is the one primitive with a genuinely different RN implementation (a native
`Modal`/bottom-sheet library), not a mechanical swap — budget real time for it in a port.

### TextField

The only text-entry primitive — entrant names, search. A `<label>` wraps the input rather
than pointing at it by id, so the association needs no generated id and tapping the label
focuses the field.

| Prop | Type | Default |
|---|---|---|
| `value` / `onChange` | `string` / `(value: string) => void` | — |
| `label` | `string` | — |
| `hideLabel` | `boolean` | `false` — keeps the label for screen readers only |
| `placeholder` | `string \| undefined` | — |
| `type` | `'text' \| 'search'` | `'text'` |
| `leading` | `ReactNode` | — rendered inside the field, e.g. a `SearchIcon` |
| `className` | `string` | `''` |

RN notes: becomes `TextInput`; `leading` becomes a sibling inside the wrapping `View`.

### StatTile

One value-over-label tile. Lives in `src/ui/` rather than `src/cards/` because three
features use it (card stat strip, Coin Flip counters, and anything else needing a small
number). Props: `label`, `value` (`number | string`), `pending` (dims without blanking).

### Icon

Base `<svg>` shell (20px, stroke-based, `currentColor`, `aria-hidden`) plus concrete icons built
on it: `ChevronLeftIcon` (back nav), `InfoIcon` (rules-text popover), `PencilIcon` (edit
affordance on the setup summary bar), `CloseIcon` (`Sheet`'s close button), `SearchIcon` (card
picker), `PlusIcon`/`TrashIcon` (add/remove entrant rows), `ChevronUpIcon`/`ChevronDownIcon`
(reorder), `ShuffleIcon` (swap pairing / reshuffle), `UndoIcon` (`sequence` log and counter-action
undo), and `TrophyIcon`. Each concrete icon accepts `size`/`className`/`...svgProps`, no `children`.

RN notes: `Icon`'s `<svg>` → `Svg`, `<path>`/`<circle>` → `Path`/`Circle` from
`react-native-svg`; path data (`d`) is unchanged.

---

## Domain components (`src/cards/`) — Phase 3–4

These consume the primitives above plus `src/core/cardModel.ts` (Phase 2). None contain
Tailwind class strings beyond thin layout wrappers — they're composition, not new styling
surface.

### HeroStat

The card's headline number (`OutputSpec` where `primary: true`, or `outputs[0]` if none is
marked — see `screen-spec.md` rule 6).

| Prop | Type |
|---|---|
| `label` | `string` (the output's `short_label ?? label`, rendered as a `label`-variant caption above the number) |
| `value` | `number` |
| `pending` | `boolean` (dims the value at reduced opacity while a recalculation is in flight — never blanks it) |

Renders via `Text` with `variant` selected by `heroFontSize(value)` from `cardModel.ts`
(`heroLg` ≤4 digits, `heroMd` 5–6, `heroSm` ≥7), formatted through `formatNumber` (grouping
separators). `aria-live="polite"` on the value so screen readers announce recalculations.

### StatStrip / StatTile

`StatStrip` is a horizontally-wrapping flex row of `StatTile`s — every non-primary output
except those marked `OutputSpec.hidden` (guard/alert feeds the player already sees expressed
elsewhere — dungeons' `at_bottom_room` feeds the counter's guard while the map marker and
completion banner say the same thing; the filter lives in `nonPrimaryOutputs`).
Renders nothing (not an empty row) when there are 0 non-primary outputs (the single-output-card
case, rule 6).

`StatTile`: `Surface` (`level="base"`, small padding) containing a `statTile`-variant value and
a `label`-variant caption underneath, matching `StatBox`'s old visual role but token-driven.

| Prop (`StatTile`) | Type |
|---|---|
| `label` | `string` |
| `value` | `number \| string` |
| `pending` | `boolean` |

### SetupSummaryBar

One-line, horizontally-scrolling (never wrapping) row of `Chip`s summarizing confirmed setup
field values, plus a trailing edit affordance. The whole bar is one `Pressable` (not
individually-tappable chips — tapping anywhere opens the sheet); see `screen-spec.md` rule 5
for the per-`FieldKind` chip text format.

| Prop | Type |
|---|---|
| `fields` | `FieldSpec[]` (setup fields only, already visibility-filtered) |
| `values` | `FieldValues` |
| `onPress` | `() => void` (opens `SetupSheet`) |

Rendered with a trailing `PencilIcon`. Not rendered at all when `fields` is empty (rule 2).

### SetupSheet

`Sheet` wrapping one `FieldControl` per setup field, titled "Board state", with a `Button`
labeled "Done" pinned at the bottom. "Done" calls the passed `onDone` (marks the card's setup
confirmed for this session — see `useCardSession` in `screen-spec.md`) in addition to `Sheet`'s
own `onClose`.

| Prop | Type |
|---|---|
| `open` | `boolean` |
| `fields` | `FieldSpec[]` (setup fields only) |
| `values` | `FieldValues` |
| `onFieldChange` | `(name: string, value: unknown) => void` |
| `onDone` | `() => void` |

### FieldControl

The `FieldSpec.kind` switch — replaces `Field.tsx`. A five-way dispatch, built from
primitives instead of raw `<input>`/`<select>`:

- `boolean` → `Toggle`
- `number` → `Stepper` (no `action_label`/guard)
- `select` → a vertical list of `Pressable` rows, one per `SelectOption`, selected one styled
  like `Toggle`'s selected segment (no native `<select>` — see `portability-rules.md`)
- `counter` → `Stepper` for the value, plus a full-width `Button` below it when `action_label`
  is set, `disabled` driven by the existing `isActionGuardBlocked` logic from `cardModel.ts`
  (moved verbatim from today's `Field.tsx`)
- `sequence` → an ordered log of the appended entries (Comet's die rolls) rendered as `Chip`s,
  each labelled by its `SelectOption.label`, with a trailing `UndoIcon` button that pops the
  last entry. The appending itself happens in `ActionBar` (a die the app rolls, or one button
  per option), not here — this control is the read-back-and-undo half.

| Prop | Type |
|---|---|
| `field` | `FieldSpec` |
| `value` | `unknown` |
| `onChange` | `(name: string, value: unknown) => void` |
| `outputs` | `OutputValues \| null` (for `action_disabled_when`) |

`help_text`, when present, renders as `body`-variant, `muted`-color `Text` below the control —
unchanged from today.

### AlertBanner

Renders `card.alert.message` in a `role="alert"` `Surface` (danger tones) above `HeroStat` when
`outputs[card.alert.output] === true`. Renders nothing otherwise, and nothing at all when the
card declares no `alert`. Sound (`playLoseSound`) fires on the false→true edge only, driven by
`useCardSession`, not by this component (keeps the component pure/presentational).

| Prop | Type |
|---|---|
| `message` | `string \| null` (already resolved to `null` when the alert isn't active) |

### ActionBar

Bottom-pinned row in the thumb zone. Three field shapes feed it, all honouring the same
`action_disabled_when` guard:

- a live `counter` with an `action_label` → an `lg` action button (`flex-1`, e.g. "Pay 50 Life")
  paired with a smaller `UndoIcon` `Pressable` beside it that decrements the counter, disabled at
  the field `min`. The undo mirrors the `sequence` log's own undo, so a mis-tap (a double "Pay 50
  Life" costs 100 life) is fixable in the thumb zone rather than by scrolling up to the stepper.
- a live `sequence` declaring `roll` → a `DieRoller` the app rolls itself (Comet); the per-option
  buttons are suppressed so nobody can report a roll the app didn't make.

### Field help and dense pickers

Every field's `help_text` folds behind a small info toggle on its label row
(`aria-expanded`): the always-on paragraphs were the single biggest space cost on a
phone, sitting between the card art and its controls. A `select` with more than three
options renders as one horizontally-scrollable row (an RN horizontal ScrollView)
instead of wrapping onto several; short lists keep the wrap.

### Compact stats (StatTile / StatStrip / HeroStat)

`StatStrip` centres its wrapping row (`justify-center`) so the tiles share the hero's
axis -- two tiles hugging the left edge under a dead-centred hero is what made the
Dungeons screen read as disjointed. All three take a `compact` prop: smaller type and
padding so the stats read as annotation rather than a peer panel. CardScreen sets it
declaratively -- `show_hero_art` compacts the strip under card art, and a live field
with a `map` folds hero and strip into one centred row above the map (the map is the
screen's main event; a full-height hero pushed it below the fold). The compact hero
keeps the accent value and the polite live region -- primary, just not tall.

### Die3D / DieRoller / DiceScreen

`Die3D` (`cards/Die3D.tsx`) is the die as a real solid, purely visual: a cube for six or
fewer faces, a true icosahedron for a d20, projected by `@mtg/core/dice3d` (quaternions,
perspective, backface culling, Lambert shading) and drawn as SVG `<polygon>`s. While
`rolling` it samples the seeded `tumblePath` on a requestAnimationFrame clock -- thrown,
bouncing on the shared contact schedule the roll sound is synthesized from, settling with
the rolled face solved exactly toward the camera plus a <=12° in-plane tilt. Decorations
(pips, or an upright numeral for faces > 6) are hidden mid-tumble and fade in from the
final contact. It decides nothing: no RNG, no result callback, no announcement; owners
drive `face`/`rolling`/`seed`. Fills and strokes are theme CSS variables passed as literal
SVG props, never Tailwind classes (the react-native-svg-portable pattern). Under reduced
motion it runs no frame loop at all: final pose, opacity ease-in over `revealDuration()`.
Design record: `docs/design/dice3d.md`.

- `DieRoller` (`cards/DieRoller.tsx`) keeps the self-deciding shape for the Comet card path:
  it owns the RNG (`rollDie`), the tumble seed, the reveal timer, the roll-clip trigger at
  `FIRST_CONTACT_FRACTION`, the `aria-live` announcement, and the Comet-specific "No
  activations left this turn." copy, rendering `Die3D` for visuals.
- `DiceScreen` (`DiceScreen.tsx`) is the standalone d6 / 2d6 / d20 roller behind the Dice tab.
  A `SegmentedControl` picks the mode (disabled while rolling). One "Roll" decides all dice up
  front via `rollDice` and reveals them off a single shared timer, so 2d6's sum is committed in
  one atomic update with one combined `aria-live` and a **visible** sum. The loss sound plays
  only on a d20 natural 1 or 2d6 snake eyes; a plain d6 always plays the neutral roll sound.
- any other live `sequence` → one `lg` button per declared `SelectOption`, two per row, each
  appending that option to the log.

A `secondary` "New turn" button sits last. Padded with `env(safe-area-inset-bottom)` so it
clears a phone's gesture bar. (`screen-spec.md` covers the multi-counter ordering.)

### DungeonMap

When the `MapSpec` names its printed card (`scryfall_id` + an `art` box per room), the
map renders as **the card itself** with the venture marker overlaid on the printed room
boxes -- the Comet treatment, same recorded exception in cardImage.ts. Each printed room
becomes an absolutely-positioned tap target (fractions of the card frame); current gets
a solid accent ring and marker dot, visited a check badge, legal-next a dashed outline,
unreachable a real disabled button. Offline, or when the image fails, the hand-drawn SVG
map below takes over with identical states, labels and caption -- one component to a
screen reader. Mad Mage's thin scry strips run under the 48px hit minimum but span the
card's full width; noted deviation, the best available without overlapping neighbours.

`DungeonMap` (`cards/DungeonMap.tsx`) renders a `map`-flagged sequence as the dungeon
itself: rooms as boxes laid out by the MapSpec's column/row (top-to-bottom -- venturing
reads as descending), edges beneath them, the walked trail lit in accent so Dark Pool
via Goblin Lair reads differently from via Mine Tunnels. The map IS the input control,
dispatched from `FieldControl`'s sequence case the way `roll` dispatches to `DieRoller`;
`ActionBar` excludes mapped sequences from its per-option buttons for the same reason.
Only legal next rooms respond (dashed accent outline); unreachable rooms stay visible
but inert and `aria-disabled` -- the shape of the road not taken is what a map shows
that a picker cannot. State is never color alone: current = filled + caption ("You are
here"), visited = check glyph, next = dashed. Long room names wrap at the space nearest
the middle. The undo control above it pops the last room -- fix-a-fat-finger, not a
rules-legal backward move, which the tap targets already forbid. No decorative
animation, so nothing needs a reduced-motion gate beyond the primitives' own press
feedback.

### CardArtHero / LoyaltyShield / LoyaltyBadge

Overlays (the loyalty badge, the dungeon room targets) wait for the image's `onLoad`:
rings floating over the blank placeholder box read as broken during a slow load.

`CardArtHero` (`cards/CardArtHero.tsx`) makes the card itself the hero: the printed image,
large, with `LoyaltyBadge` -- the live loyalty in a hand-drawn planeswalker badge -- over
the card's own printed loyalty box. A recorded decision (see the note in cardImage.ts):
the badge covers only the printed loyalty box, never the artwork proper or the artist and
copyright line, and the image is otherwise untouched. Selected declaratively by
`OutputSpec.hero_shape: "shield"` + `CardMetadata.show_hero_art` together -- the RollSpec
pattern, never a card-id switch. Offline (or for a cardless entry) it falls back to
`LoyaltyShield`, the standalone label-over-badge hero with HeroStat's data contract, so
the game state never waits on the network. When the card's alert fires (Comet dead), the
badge takes the danger tones -- the one use design-tokens.md reserves danger for.

### CardThumb

A small full-card thumbnail, and the card-back tile it degrades to. Takes a `scryfallId`
(nullable) and an optional Tailwind width; the 488×680 aspect is never a caller's choice,
since Scryfall's terms forbid distorting a card image. Scryfall's `small` version is the
**full** card, not an art crop, so the artist and copyright line stay in frame by
construction — the same argument `CardImage` rests on.

Always decorative (`alt=""`, `aria-hidden`): every caller renders the card's name beside
it. Cardless entries and failed loads both land on the tile, so a list keeps its shape
offline instead of collapsing to bare text. Used by `CardPickerScreen` rows and by
`SourcePicker` on both the roster and the search results.

### SourcePicker

The third rendering of a `sequence` field, beside the die (`RollSpec`) and the dungeon map
(`MapSpec`): a searchable roster, selected by `FieldSpec.picker` (`PickerSpec`).

Exists because a row of option pills stops working somewhere around six options, and a
landfall roster is drawn from dozens. Search is the only affordance that survives the list
growing. Results appear **only once something is typed** — a permanently-open list of every
option would push the roster itself off a phone screen, and the roster is what gets read
during a turn.

Each roster row is one option with its count (`x2`), a `+` to add another copy, and a `×`
to remove one copy — not the whole row, since two Lotus Cobras are two abilities and
dropping one is a real board change. At `field.max` the search box and every `+` disappear
and a cap message takes their place; removal stays available, so a full roster is never a
dead end. Adding twice is how the schema expresses "I control two of these".

`ActionBar` filters picker sequences out of its button row for the same reason it filters
mapped ones: the field owns its own controls inline.

### EffectList

The `list` hero shape (`OutputSpec.hero_shape: "list"` + `kind: "lines"`). One row per
source: what it does once (`effect`), what that has come to this turn (`note`, accent), and
which permanent it came from (`source`, muted).

It exists because some cards have no single headline number — with three landfall permanents
out, "what happens when this land enters" has three answers and no meaningful total. The
per-source running total lives **in the row** rather than in another tile, which is what
keeps a roster of three to three lines instead of three lines plus a dozen mostly-zero
tiles.

`aria-live="polite"` sits on the list, matching `HeroStat`'s contract: one land drop changes
every row at once.

| Prop | Type |
|---|---|
| `label` | `string` (the hero output's label) |
| `lines` | `EffectLine[]` (read via `effectLines` in `cardModel.ts`) |
| `pending` | `boolean` |
| `emptyLabel` | `string` (borrowed from the card's `PickerSpec.empty_label`) |

### CardPickerScreen / CardDetailSheet / CardImage

Specified in `screen-spec.md` alongside navigation, since they're screen-level, not reusable
components.
