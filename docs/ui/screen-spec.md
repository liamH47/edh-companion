# Screen spec

## Screens

No router library (see `portability-rules.md` — `react-router-dom` has no RN equivalent, and
Expo Router is the eventual universal answer). Screen state lives in `src/core/navigation/`,
with route names chosen to map 1:1 onto future Expo Router file routes:

```
(tabs)/cards   → CardPickerScreen   search + list of cards, most-recently-used first
(tabs)/coin    → CoinFlipScreen     CoinFlip.tsx
(tabs)/swiss   → SwissScreen        Swiss tournament pairings (see the section below)
cards/[id]     → CardScreen         pushed; hides the bottom tab bar
```

Bottom tab bar (3 destinations) replaces the original top tablist — thumb-zone reachable,
and it's the shape Expo Router expects. `CardScreen` hides it so the tab bar never competes
with the action bar for the bottom of the screen. On launch, the last-used card opens directly
(no extra tap versus today's 2-card case).

Web-only browser history sync (`pushState`/`popstate`, so Back works and a card is linkable)
lives in `src/core/navigation/useNavigation.ts` — the one file an RN port rewrites wholesale.

`App.tsx` fetches the card list *inside* the card routes rather than gating the whole app on
it. Coin Flip and Swiss are entirely local, and a backend outage must not take them down —
running a draft on bad reception is exactly when Swiss matters.

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

---

# Swiss pairings screens

A third top-level tab (`/swiss`), alongside Cards and Coin Flip. Unlike the card screens,
nothing here touches the network: pairing and scoring are pure functions in
`src/core/swiss/`, and the tournament lives in `localStorage`. See
`docs/swiss-pairings.md` for the rules those functions implement.

`SwissScreen` is the container. It owns the session via `useTournament` and picks between
three states:

- **No tournament** → `TournamentSetupScreen`.
- **In progress, viewing a round** → a pill row (`R1`, `R2`, … , `Standings`) above
  `RoundScreen`.
- **In progress, viewing standings** → the same pill row above `StandingsScreen`.

## TournamentSetupScreen

Mode (Singles / Two-Headed Giant), the entrant list in seat order, round count, and match
length. Two ways out: "Start with this seating" (round 1 from draft seats) or "Start with
random pairings" (Sealed, which has no seating).

**Seating is the reason this screen exists.** The MTG Companion app makes you type every
name and then *assigns* seats, with no way to say how you actually sat. So both are
offered: a "Randomize seats" button, and per-row move-up/move-down buttons. Move buttons
rather than drag-and-drop — touch-friendly, keyboard-accessible, 48px targets, and
portable to React Native.

Switching to Two-Headed Giant grows every row to two name fields and forces best-of-one
(`createTournament` enforces this too, so the UI can't get out of step with the model).

## RoundScreen

The round's pairings, each row tappable to open `MatchResultSheet`. Rows show both names
stacked with the scoreline on the right: `Not reported`, a scoreline like `2-1`, `Draw`,
or `Bye`. A bye is unreportable — it's recorded as a 2-0 win the moment it's created.

Each unreported row also carries a shuffle button for the **manual pairing override**:
pick another entrant in the round and the two swap places. Both affected matches lose
their results, since a reported result no longer describes who played.

Only one bottom-pinned action, "Start round N", and only when the round is complete, it's
the latest round, and rounds remain. Standings are always one tap away in the pill row, so
repeating them at the bottom would put two competing buttons in the thumb zone.

## MatchResultSheet

Scorelines written from entrant A's side, which is why A's name is shown first: `2-0`,
`2-1`, `1-1 draw`, `1-2`, `0-2` for best-of-three; `1-0` / `Draw` / `0-1` for best-of-one.
The already-reported scoreline is marked `aria-pressed`, and an existing result can be
cleared back to unreported.

**Editing a result from a round that later rounds were paired from** is the same flow,
with one addition: the sheet explains that standings update either way, and offers
"Re-pair later rounds". Keeping the pairings is the default — people may already be
playing — and re-pairing is the deliberate opt-in.

## StandingsScreen

Rank, name, record and match points, with all four tiebreakers (OMW%, GW%, OGW%) in a
horizontally scrollable strip so a phone shows name and record without squeezing them.
Flex rows, not a table or CSS grid (`portability-rules.md`). Dropped entrants are marked
but still listed — they still count in everyone else's tiebreakers.

Below the table: "Manage drops" (a sheet toggling each entrant in or out) and "End
tournament".
