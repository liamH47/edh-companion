# Screen spec

## Screens

No router library (see `portability-rules.md` — `react-router-dom` has no RN equivalent, and
Expo Router is the eventual universal answer). Screen state lives in `src/core/navigation/`,
with route names chosen to map 1:1 onto future Expo Router file routes:

```
(tabs)/cards   → CardPickerScreen   search + list of cards, most-recently-used first
(tabs)/coin    → CoinFlipScreen     (existing CoinFlip.tsx, restyled in Phase 5)
cards/[id]     → CardScreen         pushed; hides the bottom tab bar
```

Bottom tab bar (2 destinations today) replaces the current top tablist — thumb-zone reachable,
and it's the shape Expo Router expects. `CardScreen` hides it so the tab bar never competes
with the action bar for the bottom of the screen. On launch, the last-used card opens directly
(no extra tap versus today's 2-card case).

Web-only browser history sync (`pushState`/`popstate`, so Back works and a card is linkable)
lives in `src/core/navigation/history.web.ts` — the one file an RN port drops entirely.

## CardScreen layout

```
┌──────────────────────────────┐
│ ‹  Aetherflux Reservoir    ⓘ │  header: back, title, rules-text info button
├──────────────────────────────┤
│ 40 life · in play ✓       ✎ │  SetupSummaryBar (only if setup fields exist)
├──────────────────────────────┤
│         (alert banner)       │  AlertBanner (only if card.alert is active)
│                              │
│   DAMAGE AVAILABLE           │
│        50                    │  HeroStat
│                              │
│  ┌──────┐┌──────┐┌──────┐    │
│  │  50  ││  +4  ││   7  │    │  StatStrip (only if >0 non-primary outputs)
│  └──────┘└──────┘└──────┘    │
├──────────────────────────────┤
│  (live-only FieldControls)   │  omitted entirely if there are no live fields
├──────────────────────────────┤
│         ActionBar             │  action button (if any) + "New turn"
└──────────────────────────────┘
```

`RulesTextPopover`: the header's info button opens a small popover/sheet showing
`card.rules_text` — currently fetched but never displayed anywhere; this is where it surfaces.

`CardPickerScreen`: a search field (filters by `card.name`, client-side, case-insensitive) over
a vertical list of cards, most-recently-opened first (tracked in `src/core/storage.ts`, not the
backend). Selecting a card pushes `CardScreen`.

## The 9 generic rules

These are implemented once in `src/core/cardModel.ts` and must hold for every current and future
card with zero per-card branching in the UI layer.

1. **Field split.** `visibleFields` = today's `isFieldVisible` logic (`field.visible_if` is
   either absent or `values[visible_if.field] === visible_if.equals`). Split into
   `setupFields` (`field.setup === true`) and `liveFields` (the rest).
2. **No setup fields → no summary bar, no sheet.** `SetupSummaryBar` and `SetupSheet` don't
   render at all.
3. **No live fields → setup fields render inline** in the play area (below the stat strip,
   where live `FieldControl`s would normally go) instead of only behind the sheet, and
   `SetupSummaryBar` is suppressed. Guarantees no card ever shows an empty play surface — this
   was Craterhoof's failure mode before its `additional_triggers` field was flipped to live
   (see `backend/app/cards/craterhoof_behemoth.py`); the rule stays as a safety net for any
   future all-setup card.
4. **First open of a card with setup fields auto-opens the sheet.** Closing it (Done, backdrop,
   Esc, swipe) marks that card's setup "confirmed" for the session
   (`src/core/useCardSession.ts`, keyed by `card.id`, held in memory + `src/core/storage.ts` so
   it survives a refresh). Re-entering an already-confirmed card does not re-open the sheet.
   "New turn" resets field *values* to their defaults but does **not** clear the confirmed flag
   — re-answering "in play at turn start?" every turn would defeat the point of collapsing it.
5. **Summary bar chip text**, one `Chip` per visible setup field:
   - `number` / `counter`: `` `${value} ${short_label}` `` (e.g. "40 start life")
   - `boolean`: `` `${short_label} ${value ? '✓' : '✗'}` `` (e.g. "in play ✓")
   - `select`: the matching `SelectOption.label`
   - Falls back to `label` (truncated by the bar's `overflow-x` clipping, not JS) when
     `short_label` is null.
6. **Hero output** = `card.outputs.find(o => o.primary) ?? card.outputs[0]`. Every other output
   becomes a `StatTile`. A card with exactly one output renders only `HeroStat`, no
   `StatStrip` (an empty strip is worse than no strip).
7. **Alert.** When `card.alert` is set and `outputs[card.alert.output] === true`, `AlertBanner`
   renders `card.alert.message` above `HeroStat`, and `useCardSession` fires `playLoseSound()`
   on the false→true edge only (ported verbatim from today's `wasGameLostRef` pattern in
   `CardForm.tsx`). No card-specific code — `game_lost` is no longer a hardcoded name anywhere
   in the frontend.
8. **Number formatting.** Every numeric output/value renders through
   `formatNumber` (`Intl.NumberFormat('en-US')`, grouping separators) and, for the hero only,
   `heroFontSize(value)` picks the `Text` variant by digit count: ≤4 digits → `heroLg` (64px),
   5–6 → `heroMd` (48px), ≥7 → `heroSm` (36px). Verifies against Scute Swarm-scale numbers
   (`docs/future-card-ideas.md` — land counts can compound past 6 digits).
9. **Counter action guard** is unchanged behavior, moved verbatim: `action_disabled_when`
   disables the action button when the named *output* (not input) is below the threshold, and
   defaults to disabled (not permissive) while `outputs` is still `null` on first load.

## Worked examples

**Aetherflux Reservoir** (5 fields: 3 setup, 2 live; 7 outputs, 1 primary, 1 alert): sheet
auto-opens on first visit → "Life at turn start" `Stepper`, "In play at start of turn?"
`Toggle`, conditionally "Spells already cast before it entered" `Stepper` → Done → summary bar
reads `40 start life · in play ✓` → hero shows `damage_available` under "DAMAGE" → strip shows
the other 6 outputs → live area shows the "Spells cast this turn" `Stepper` → `ActionBar` shows
"Pay 50 Life" (disabled below 50 current life) + "New turn". Paying down to exactly 0 triggers
`AlertBanner` + lose sound once.

**Craterhoof Behemoth** (4 fields: 2 setup, 2 live; 4 outputs, 1 primary, no alert): sheet has
only "Total power before triggers" and "Creatures at first trigger" — 2 fields, still worth a
sheet (rule 2 only suppresses the sheet at *zero* setup fields, not "few"). Live area shows
"Second trigger this turn?" `Toggle`-shaped counter and, once toggled, "Creatures at second
trigger" `Stepper` (rule: `visible_if` applies identically inside the live area). No action
button in `ActionBar`, just "New turn" — rule 9 doesn't force an `ActionBar` button to exist.

**Hypothetical all-setup card** (rule 3): if every field were `setup: true`, `SetupSummaryBar`
is suppressed and every field renders inline in the play area instead — never behind a sheet
with nothing live underneath it.

**Hypothetical single-output card** (rule 6, e.g. Blood Artist from
`docs/future-card-ideas.md`): `HeroStat` alone, no `StatStrip`.
