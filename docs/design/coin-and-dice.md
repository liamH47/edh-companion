# Coin flip (plain) and dice roller — design

Status: **implemented.** Originally recovered from a cloud session that reached quorum but
committed no code, so the plan was lost on each re-fire; recorded here, re-reviewed by the
three specialist agents, then built. Kept as the record of why the screens are shaped this
way. One deliberate divergence from the reviewed plan is noted under "Review refinements":
the single-timer `DiceScreen` design removes the two-timer race the `rollId` gate was meant
to cover, so no `rollId` gate was needed.

The three specialist agents (`card-interaction-designer`, `ui-reviewer`,
`edge-case-hunter`) re-reviewed this against the real code. Their refinements are folded
in below; the "Review refinements" section at the end lists what changed from the first
recovered draft, including one correctness bug the recovered plan would have shipped.

## What was asked for

1. A **plain coin flip** not tied to specific commanders. The Krark / Okaun / Zndrsplt
   experience becomes an optional toggle rather than the default.
2. A **dice roller** with satisfying animation and sound for at least: **single d6**,
   **two d6**, **single d20**.
3. The **loss sound** (the "coin flip failed" clip) plays when someone rolls a **1**
   (d6 / d20) or **snake eyes** (two 1s on 2d6).

## Consulted

Three specialist agents reviewed concurrently and reached quorum:
`card-interaction-designer` (play pattern on screen), `ui-reviewer` (presenting a new
kind of data, tab/IA), `edge-case-hunter` (bounds and breakage). The points below are
where they agreed; the two genuine splits are called out under "Open decisions".

## Agreed by consensus

### Coin
- **Default is generic.** A hand-drawn generic heads/tails coin face and generic copy —
  **new SVG**, since only `KrarkFace`/`KrarkThumb` exist today. The Krark art, the Okaun
  power/toughness tracker, and the Zndrsplt "draws a card" note all **hide unless
  commander mode is on**.
- **Commander mode is a persisted toggle.** Use the existing `Toggle` primitive. New
  prefs live in `packages/core/src/coin.ts` alongside `flipCoin()`, default **off**.
  **Do NOT copy `sound.ts`'s check.** `isSoundEnabled()` returns `getItem(key) !== 'off'`,
  which treats empty storage (`null`) and any garbage value as *enabled* — copying that
  shape would default commander mode **on**, backwards from the whole redesign. Copy
  `theme.ts`'s allow-list shape instead: `isCommanderModeEnabled()` returns
  `getItem(key) === 'on'`, everything else → `false`. Unit-test that `null`, `'true'`,
  `'1'`, and garbage all resolve to `false`. (edge-case-hunter — this was a real bug in
  the recovered draft.)
- **Toggling always means a fresh start.** The toggle handler zeroes `wins`/`losses` in
  both directions, wired as a side effect of the handler itself — *not* tied to a reset
  button (Minimal plain mode has none). Simplest correct idiom: key the coin subtree by
  commander mode (`key={commanderMode}`) so the switch also clears the `rotation` /
  `isFlipping` timer state for free.
- The current global `SoundToggle` sits inside the coin screen but actually gates **card**
  win/lose sounds too (and will soon gate the dice roll sound) — it is mislabeled and
  mis-placed. There should be **exactly one** `SoundToggle`, globally, in the header
  immediately left of `ThemeToggle`, mirroring the single `ThemeToggle`. **Delete it from
  `CoinFlip.tsx` in both modes** — do not keep a mode-conditional copy. Rebuild it on the
  `Icon` primitive (two new icons, e.g. `SpeakerIcon`/`SpeakerOffIcon`) rather than the
  hand-rolled `<svg>` it uses today, and fix the label to a generic `Mute sound` /
  `Unmute sound`. (ui-reviewer)

### Dice
- **Roll math goes into core.** New `packages/core/src/dice.ts` exposing `rollDie(faces)`
  and `rollDice(count, faces)`, mirroring `flipCoin()`. Randomness stays at the edge so
  any compute stays pure and testable. **No Python mirror** — the parity rule is about
  card behaviour (`backend/app/cards/*.py`), not client-side utilities like this or
  `coin.ts`. (ui-reviewer)
- **Mode selector = a new `SegmentedControl` primitive.** The Swiss screen already
  hand-rolls the `role="radiogroup"` pattern twice (`EVENT_FORMATS` and the Singles/THG
  pill). Dice would be the third. Extract `SegmentedControl<T>` into `apps/web/src/ui/`
  (`options`, `value`, `onChange`, group `label`), migrate the Swiss `EVENT_FORMATS`
  selector to it, and have `DiceScreen` consume it for `d6` / `2d6` / `d20`. Keep the
  existing `Toggle` for genuinely 2-way choices. (ui-reviewer)
- **2d6 is one "Roll" button, and always two separate `faces=6` dice.** Never one
  `faces=12` die: `PIPS_BY_FACE` only has entries 1–6, so feeding a sum of 7–12 into a
  single die widget crashes on `PIPS_BY_FACE[face].map` of `undefined`. Add a defensive
  numeral fallback in `DieFace` regardless. (edge-case-hunter)
- **Show the sum on screen, not only to a screen reader.** A visible sum under the two
  dice — a sighted player should not have to add the pips in their head; that is the
  friction a dice roller exists to remove. Plus one combined `aria-live` announcement
  (e.g. "Rolled 4 and 3 — sum 7"), committed in a **single atomic state update**.
  (interaction-designer + edge-case-hunter)
- **One roll generation gates everything.** A single `rollId`/generation ref both (a)
  gates the atomic sum commit and (b) drives "disable the mode selector while rolling",
  cleared only when **both** dice have landed — never derived from one die's own
  `rolling` state (which goes false the moment that one die lands, re-enabling the
  selector mid-flight). Reset the two-die buffer at roll **start**, not just at
  completion, so a never-completing die B can't combine a stale value into the next
  roll's sum. (edge-case-hunter)
- **`TumblingDie` is purely presentational.** Extract it from today's `DieRoller` as a
  controlled component — `face` and `rolling` in; **no** internal RNG, `onRolled`,
  `aria-live`, or the Comet-specific "No activations left this turn." copy. Those stay in
  the callers: `ActionBar`/`DieRoller` keep the self-deciding shape and their own
  announcement for the Comet card path; `DiceScreen` supplies the single combined
  announcement. Otherwise 2d6 emits three aria-live regions per roll. Two fully-covered
  test files result (`DieRoller` + `TumblingDie`). (interaction-designer + edge-case-hunter)
- d20 needs **no new art** — `DieFace` already renders the number for faces > 6; the
  two-digit glyphs ("13"/"20") render cleanly by inspection (verify in the e2e pass, a
  headless browser was not reachable during review).
- **Animation.** A two-phase, state-driven `scale` pop on landing (overshoot to ~1.08,
  settle to 1.0 on a second timer) added to the rotate/opacity transform — **not** a CSS
  `@keyframes` bounce, which has no React Native equivalent. Maps directly onto
  `Animated.sequence` on native. `revealDuration()` is shared across both dice so they
  land together. (interaction-designer)

### Sound
- Add a **neutral `playRollSound()`** to the sound seam (`packages/core/src/sound.ts`).
  The existing win/lose API is call-specific; a roll needs its own neutral clip. Wire the
  web backend through the **same `playClip` helper** as win/lose, so the `.play()?.catch()`
  swallows a missing/blocked asset — do not hand-roll a new `new Audio(url).play()` call
  site that could leak an unhandled rejection on a 404. (edge-case-hunter)
- **Failure rule, narrowed:** play `playLoseSound()` on a **d20 natural 1** or **2d6
  snake eyes** only. A lone **1 on a plain d6 plays the neutral roll sound** — an
  unmodified d6 with no attached game effect carries no shared "bad roll" convention, so a
  loss cue there reads as arbitrary. A nat-1 (crit-fail) and snake-eyes (craps) do carry
  it. (interaction-designer — narrowed from the recovered "1 or snake eyes everywhere".)
- The roll clip is a real asset played via `new Audio(url)`, exactly like `win.mp3` /
  `lose.mp3`. A Web Audio *synth* was rejected: it creates an untestable branch and the
  packages are at 100% coverage with no coverage-ignore precedent. **Resolved:** since
  `ffmpeg` is not available in the cloud VM, generate a short dice-rattle **`roll.wav`**
  with Python's stdlib `wave` module and ship it at `apps/web/public/sounds/roll.wav`.
  Format is invisible to the tests (they stub `Audio` and assert only the URL), and both
  `new Audio(url)` and the eventual `expo-audio` backend play WAV. No `ffmpeg`/mp3
  dependency, no waiting on an external asset. (interaction-designer + edge-case-hunter)

## Edge-case guards to bake in (edge-case-hunter)

- Key the roller by mode (`key={mode}`) so switching mode mid-roll unmounts the old die
  and clears its timers; **disable the mode selector while rolling**, driven by the single
  `rollId` generation described in the Dice section.
- An **in-flight `useRef` guard** at the top of the flip and roll handlers, so a
  double-tap cannot double-count. Higher priority than it first looked: Minimal plain mode
  makes "Flip" the single, repeatedly-mashed "who goes first" button.
- **Disable the commander toggle mid-flip.**
- The commander toggle **resets the tally via its own handler** (see Coin section) — there
  is no "Reset"/"New Turn" button in Minimal plain mode, so this cannot be tied to a
  button. (The recovered "conditional reset label" item is dropped as moot.)
- Persisted prefs use the `theme.ts` allow-list shape (`=== 'on'`), not the `sound.ts`
  `!== 'off'` shape — see the Coin section for why this is load-bearing, not stylistic.
- Convert `App.tsx`'s `activeTab` ternary chain to an **exhaustive `switch`** (or a test
  over every `Route.name`) when adding `dice`, so a missed case is a type error rather
  than a silently wrong tab highlight.
- Two-digit d20 glyphs ("20", "13") render cleanly in `DieFace` by inspection — confirm in
  the e2e pass.

## Decisions (all resolved after review)

1. **Coin default appearance → Minimal.** A single "Flip" button and a bare
   "Heads!/Tails!" result: no call-heads/tails, no wins/losses/total, no reset. Call +
   stats + Okaun return only in commander mode. The interaction-designer's stronger
   argument: a real coin never hears the call — it's made out loud between players before
   the flip — so `Flip → result` is the *faithful* representation, not merely the simpler
   one. (Selected by the repo owner; re-confirmed by review. The ui-reviewer's
   tracking-in-plain-mode alternative was set aside.)
2. **Roll sound asset → stdlib-generated `roll.wav`.** See the Sound section. No `ffmpeg`,
   no external asset, no deferral.

## Placement — 4th "Dice" tab (resolved)

A **fourth "Dice" tab** alongside Cards / Coin Flip / Pairings, confirmed by all three
agents over a merged Coin/Dice tab: one-handed table use rewards single-tap access over a
tidier bar, and 4 tabs fit at a 420px viewport with `min-h-12 flex-1` untouched. Requires
a `dice` route in `packages/core/src/navigation/navigation.ts` (`Route` union +
`routeToPath`/`pathToRoute` + test), a `TabName` entry and `TABS` row in
`apps/web/src/TabBar.tsx`, `goToDice` in `useNavigation`, and the exhaustive-`switch` fix
in `App.tsx`.

## Doc updates this ships with

- `docs/ui/screen-spec.md`: route table gains `(tabs)/dice → DiceScreen`; the "Bottom tab
  bar (3 destinations)" line becomes 4; a short worked-example paragraph for Minimal vs
  commander-mode coin (the absence of any coin rule is what let this decision drift).
- `docs/ui/component-spec.md`: a `SegmentedControl` primitive entry, and a
  `TumblingDie`/`DiceScreen` entry alongside `DieRoller`.

## Files this will touch

Core:
- `packages/core/src/dice.ts` (+ test) — new roll math (`rollDie`, `rollDice`)
- `packages/core/src/coin.ts` (+ test) — commander-mode pref (`=== 'on'`), by `flipCoin()`
- `packages/core/src/sound.ts` (+ test) — `playRollSound()` on the seam
- `packages/core/src/navigation/navigation.ts` (+ test) — `dice` route
- `packages/core/src/index.ts` — barrel exports

Web app:
- `apps/web/src/sound.ts` — register the roll clip via the existing `playClip`
- `apps/web/src/CoinFlip.tsx` (+ test) — Minimal default + commander toggle + generic faces
- `apps/web/src/DiceScreen.tsx` (+ test) — new; orchestrates d6 / 2d6 / d20 + sum + sound
- `apps/web/src/cards/DieRoller.tsx` — render extracted `TumblingDie`, keep self-deciding
- `apps/web/src/cards/TumblingDie.tsx` (+ test) — new presentational die
- `apps/web/src/ui/SegmentedControl.tsx` (+ test) — new primitive
- `apps/web/src/ui/Icon.tsx` (+ test) — two speaker icons for `SoundToggle`
- `apps/web/src/SoundToggle.tsx` (+ test) — rebuilt on `Icon`, generic label
- `apps/web/src/swiss/TournamentSetupScreen.tsx` — migrate `EVENT_FORMATS` to `SegmentedControl`
- `apps/web/src/TabBar.tsx`, `apps/web/src/App.tsx` — `dice` tab + exhaustive `switch`
- `apps/web/public/sounds/roll.wav` — the roll asset (stdlib-generated)

Docs + tests:
- `docs/ui/screen-spec.md`, `docs/ui/component-spec.md` — see "Doc updates" above
- `e2e/` — a dice spec, and coin-flip spec updates for the two modes
- All gated by `/verify` (100% coverage both packages, parity corpus, lint, types).

## Review refinements (what changed from the first recovered draft)

- **Bug fixed before it shipped:** commander-mode pref must use `theme.ts`'s `=== 'on'`
  allow-list, not `sound.ts`'s `!== 'off'` — the latter defaults *on*, backwards.
- 2d6 gets a **visible on-screen sum**, not just an `aria-live` one.
- 2d6 is always **two `faces=6` dice**, never one `faces=12` die (would crash on
  `PIPS_BY_FACE`); `DieFace` gets a numeral fallback.
- A single **`rollId` generation** gates the atomic sum and the "disable selector while
  rolling" state; buffer resets at roll start.
- Loss sound **narrowed** to d20 nat-1 and 2d6 snake-eyes; plain d6 rolls the neutral clip.
- Mode selector becomes an extracted **`SegmentedControl`** primitive; the Swiss
  `EVENT_FORMATS` selector migrates to it.
- **One** global `SoundToggle` in the header, rebuilt on `Icon`; deleted from the coin
  screen entirely (not mode-conditional).
- `TumblingDie` is strictly presentational — per-die `aria-live` and Comet copy move to
  callers.
- Landing pop is a **state-driven two-phase scale**, not CSS `@keyframes`.
- **No Python mirror** for `coin.ts`/`dice.ts` — parity is for card behaviour only.
- `App.tsx` tab dispatch becomes an exhaustive `switch`.
- Roll asset resolved to a stdlib-generated **`roll.wav`**.
</content>

## Erratum (2026-08-20)

Two recorded decisions above are superseded by the real-3D dice work; they are left in
place because this doc records iteration rather than rewriting it:

- "d20 needs **no new art**" -- reversed. The d20 is now a true icosahedron and the d6 a
  projected cube, drawn as SVG polygons from `packages/core/src/dice3d/`. The numeral
  fallback survives for dice with no standard solid here (a d12 shows its number on a
  cube face). See `docs/design/dice3d.md`.
- "Landing pop is a state-driven two-phase scale" -- replaced twice over: first by a
  keyframe throw/bounce/settle, then by the continuous seeded tumble in `dice3d/tumble.ts`,
  sampled per frame. `TumblingDie` itself is gone; `Die3D` is the visual, with the same
  owner contract (no RNG, no callback, no announcement).
