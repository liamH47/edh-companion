# Component spec

Each section is self-contained — hand a single section to a model building that one component.
Every component lives at `frontend/src/ui/<Name>.tsx` (primitives) or
`frontend/src/cards/<Name>.tsx` (domain), with a co-located `<Name>.test.tsx` covering every
prop value and branch (this repo's Vitest config enforces 100% line/branch/function coverage —
see `frontend/vite.config.ts`).

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
| `padded` | `boolean` | `true` | Applies `p-4` (16px) when true |
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

### Icon

Base `<svg>` shell (20px, stroke-based, `currentColor`, `aria-hidden`) plus five concrete icons
built on it: `ChevronLeftIcon` (back nav), `InfoIcon` (rules-text popover), `PencilIcon` (edit
affordance on the setup summary bar), `CloseIcon` (`Sheet`'s close button), `SearchIcon` (card
picker). Each concrete icon accepts `size`/`className`/`...svgProps`, no `children`.

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

`StatStrip` is a horizontally-wrapping flex row of `StatTile`s — every non-primary output.
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

The `FieldSpec.kind` switch — replaces `Field.tsx`. Same four-way dispatch, now built from
primitives instead of raw `<input>`/`<select>`:

- `boolean` → `Toggle`
- `number` → `Stepper` (no `action_label`/guard)
- `select` → a vertical list of `Pressable` rows, one per `SelectOption`, selected one styled
  like `Toggle`'s selected segment (no native `<select>` — see `portability-rules.md`)
- `counter` → `Stepper` for the value, plus a full-width `Button` below it when `action_label`
  is set, `disabled` driven by the existing `isActionGuardBlocked` logic from `cardModel.ts`
  (moved verbatim from today's `Field.tsx`)

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

Bottom-pinned row: the live counter's action button (if the card has exactly one — see
`screen-spec.md` for the multi-counter case) sized `lg`/`fullWidth`, plus a `secondary` "New
turn" button below it. Padded with `env(safe-area-inset-bottom)` so it clears a phone's gesture
bar.

### CardPickerScreen / RulesTextPopover

Specified in `screen-spec.md` alongside navigation, since they're screen-level, not reusable
components.
