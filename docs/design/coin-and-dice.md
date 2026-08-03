# Coin flip (plain) and dice roller — design

Status: **agreed, not yet implemented.** Written into the repo so it survives a session
restart — the design reached quorum in a cloud session that committed no code, and the
plan was lost each time the session re-fired. It is recorded here so that does not
happen again.

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
- **Default is generic.** A hand-drawn generic heads/tails coin face and generic copy.
  The Krark art, the Okaun power/toughness tracker, and the Zndrsplt "draws a card" note
  all **hide unless commander mode is on**.
- **Commander mode is a persisted toggle.** Use the existing `Toggle` primitive. New
  prefs live in `packages/core/src/coin.ts`, mirroring the shape of `sound.ts`
  (`isCommanderModeEnabled()` / `setCommanderModeEnabled()` over `storage`). Default
  **off**.
- **Toggling resets the tally.** Switching commander mode runs the same reset path as
  the "New Turn" button, so `wins` never silently pre-loads Okaun's doubling from a prior
  plain-mode session. (edge-case-hunter)
- The current global `SoundToggle` sits inside the coin screen but actually gates **card**
  sounds too — it is mislabeled and mis-placed. **Move it to the header** next to the
  theme toggle with a generic label; hide the in-screen one in plain mode.

### Dice
- **Roll math goes into core.** New `packages/core/src/dice.ts` exposing `rollDie(faces)`
  and `rollDice(count, faces)`, mirroring `flipCoin()`. Randomness stays at the edge so
  any compute stays pure and testable.
- **Mode selector is a radiogroup** (`d6` / `2d6` / `d20`), matching the Swiss format
  selector's `role="radiogroup"` pattern for three-way selection.
- **2d6 is one "Roll" button.** Both dice tumble together; the sum is committed in a
  **single atomic state update** (not two `setState`s); one combined `aria-live`
  announcement: e.g. "Rolled 4 and 3 — sum 7". (edge-case-hunter)
- **Split the die presentationally.** Extract a presentational `TumblingDie` from today's
  `DieRoller` so the Comet / `ActionBar` card path stays untouched; the new dice screen
  owns orchestration (how many dice, sum, sound, mode). d20 needs **no new art** —
  `DieFace` already renders the number for faces > 6.
- **Animation.** Add `scale` to the existing rotate/opacity transform for a satisfying
  pop on landing. `revealDuration()` is shared across both dice so they land together.

### Sound
- Add a **neutral `playRollSound()`** to the sound seam (`packages/core/src/sound.ts`).
  The existing win/lose API is call-specific; a roll needs its own neutral clip.
- **Failure rule:** on a **1** (d6 / d20) or **snake eyes** (2d6), play `playLoseSound()`
  instead of the roll sound. Otherwise play the roll sound.
- The roll clip is a real asset played via `new Audio(url)`, exactly like `win.mp3` /
  `lose.mp3`. A Web Audio *synth* was rejected: it creates an untestable branch and the
  packages are at 100% coverage with no coverage-ignore precedent. See "Open decisions"
  for how the asset gets produced — `ffmpeg` is **not** available in the cloud VM.

## Edge-case guards to bake in (edge-case-hunter)

- Key the roller by mode (`key={mode}`) so switching mode mid-roll unmounts the old die
  and clears its timers; **disable the mode selector while rolling**.
- An **in-flight `useRef` guard** at the top of the flip and roll handlers, so a
  double-tap cannot double-count.
- **Disable the commander toggle mid-flip.**
- **Conditional reset label**: "New Turn" in commander mode vs "Reset" in plain mode.
- Validate persisted prefs defensively, the way `theme.ts` does, so a garbage stored
  value cannot wedge the screen.
- Confirm two-digit d20 glyphs ("20", "13") render cleanly in `DieFace`.

## Open decisions (needed before or during build)

1. **Coin default appearance.** The two agents split:
   - *Minimal: just Flip → result* — a single "Flip" button and a bare "Heads!/Tails!"
     result, no call-heads/tails, no wins/losses/total, no "New Turn". Cleanest for the
     common table use (decide who goes first). Call + stats return in commander mode.
     (interaction-designer's pick, and the **recommended** option.)
   - *Coin + win/loss tracking* — plain mode still has Call Heads / Call Tails and a
     wins/losses tally, just without Krark/Okaun/Zndrsplt. (ui-reviewer's pick.)

   **Resolved: Minimal** — selected by the repo owner.

2. **How the roll sound asset is produced.** `ffmpeg` is unavailable in the cloud VM, so
   a rattle cannot be transcoded to `.mp3` there. Candidate resolutions, to confirm:
   generate a short WAV rattle with Python's stdlib `wave` module and reference
   `/sounds/roll.wav`; or have the owner drop in a `roll.mp3`; or reuse `lose.mp3` for
   failures and ship the roll sound in a follow-up. (Format is invisible to the tests —
   the sound test stubs `Audio` and only asserts the URL.)

## Placement (to confirm)

A **fourth "Dice" tab** alongside Cards / Coin Flip / Pairings (interaction-designer's
pick). Requires a `dice` route in `packages/core/src/navigation`, a `TabName` entry in
`apps/web/src/TabBar.tsx`, and wiring in `App.tsx`.

## Files this will touch

- `packages/core/src/dice.ts` (+ test) — new roll math
- `packages/core/src/coin.ts` (+ test) — commander-mode pref, alongside `flipCoin()`
- `packages/core/src/sound.ts` (+ test) — `playRollSound()` on the seam
- `packages/core/src/navigation/*` — `dice` route
- `packages/core/src/index.ts` — barrel exports
- `apps/web/src/sound.ts` — register the roll clip in the web backend
- `apps/web/src/CoinFlip.tsx` (+ test) — plain default, commander toggle
- `apps/web/src/cards/DieRoller.tsx` — extract presentational `TumblingDie`
- `apps/web/src/DiceScreen.tsx` (+ test) — new, orchestrates d6 / 2d6 / d20
- `apps/web/src/TabBar.tsx`, `apps/web/src/App.tsx`, `SoundToggle` placement
- `apps/web/public/sounds/roll.*` — the roll asset
- `e2e/` — a dice spec, and coin-flip spec updates for the two modes
- All gated by `/verify` (100% coverage both packages, parity corpus, lint, types).
</content>
