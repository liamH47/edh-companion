# Roadmap

Where this project is and what is left. Written into the repo deliberately: a Claude Code
cloud session clones the repo and cannot see anything on a local machine, so a plan that
lives only in `~/.claude/plans/` is invisible there.

Last updated 2026-08-20 (evening: 3D dice, Comet card screen, Dungeons).

## Where it stands

The web app is **complete and deployed** at <https://mtg-calc.onrender.com>, and works
entirely offline — card metadata is bundled and compute runs in the browser, so no tab
needs a connection.

Four tabs:

- **Cards** — **16 calculators**, each a Python module plus a mirrored TypeScript
  implementation. Twelve are real cards; **Commander Tax, Dungeons, Landfall, Storm and
  Mana Pool are cardless format mechanics**, which is why the schema allows
  `scryfall_id: None`. **Landfall and Storm are rosters**: pick the cards in play (or in
  hand) out of a searchable list, and the screen reads out what each one does at once.
  Landfall covers 29 permanents and catches the second-resolution riders (Tannuk, Nissa,
  Scythecat Cub) that are missed constantly at a real table; Storm covers all 34 storm
  cards against the four with their own screens, so two payoffs can be compared at one
  count. Both share `effects.py` / `cards/effects.ts`. **Mana Pool** tracks floating mana
  by color with hand-drawn Magic symbols, splitting coloured from colorless and counting
  how many distinct colours are available; the same pool sits on the Landfall screen,
  since "add one mana of any color" is the app knowing the amount and only the player
  knowing the colour. Dungeons
  tracks all four dungeon cards (Undercity included, its initiative gating recorded in
  the option label) as a tappable room map — the `map` capability on a sequence field,
  with walk legality parity-proven on both sides — and Comet's screen shows the card
  itself with the live loyalty overlaid on the printed loyalty box (the one recorded
  exception to the no-overlay rule; decision note in `cardImage.ts`). **Card-first is
  the default everywhere**: every real card sets `show_hero_art` (art beside the hero
  number), and the picker leads each row with a full-card thumbnail, degrading to a
  card-back tile offline and for the two cardless mechanics.
- **Pairings** — opens on a chooser, because most Commander meetups don't run Swiss.
  Casual **Commander pods** is the headline option (generate tables and reshuffle each
  round to minimise repeat tablemates — no scoring); full **Swiss** is one tap away, with
  1v1 and Commander pods, drops, re-pairing, and MTR tiebreakers.
- **Coin Flip** — a plain flip, with Okaun/Zndrsplt tracking as an opt-in mode.
- **Dice** — d6, 2d6 and d20, as **real projected 3D solids** (a cube and a true
  icosahedron, own quaternion math in `packages/core/src/dice3d/`, zero dependencies),
  thrown, bouncing on the same contact schedule the roll sound is synthesized from
  (`generate_roll_sound.py --check` guards the sync in CI). Design record:
  `docs/design/dice3d.md`.

Every deploy is gated on CI: backend lint/format/types/tests, a design-tokens freshness
check, both frontend packages at 100% coverage, a parity corpus proving Python and
TypeScript agree, and Playwright end-to-end against the real Docker image (31 specs run on
both a desktop and a Pixel 7 viewport).

Nothing is half-finished. There is no broken state to return to.

## Layout

```
apps/web/            the React web app (Vite, Tailwind v4)
packages/core/       platform-free logic + design tokens -- no DOM, enforced by tsconfig
backend/             FastAPI: serves the SPA, publishes /api/cards, owns card behaviour
e2e/                 Playwright, run against the built Docker image
docs/                this roadmap, the UI specs, the deployment runbook, card ideas
.claude/             five agents, two skills and a SessionStart hook, shared via the repo
CLAUDE.md            the rules a session in this repo has to follow
```

## What is left

All of it is the mobile port. See `docs/ui/portability-rules.md` for why the split above
makes this cheap.

**Phase 7 — Expo scaffold and platform seams.** `packages/core` already exposes settable
backends for storage, compute, reduced-motion, haptics and sound; `apps/web/src/platform.ts`
is the web half. A native app needs the same file with MMKV, `AccessibilityInfo`,
`expo-haptics` and `expo-audio`. **Storage must stay synchronous** — which is why MMKV
rather than AsyncStorage. Five components now read storage during render, up from three
when this was first written: `ThemeToggle` (`getInitialTheme`), `SoundToggle`, `CoinFlip`
(commander mode), `useCardSession` (setup confirmed), and `PairingsScreen` (`initialMode`,
which checks for both a saved pod session and a saved tournament). An async store would
mean a flash of the wrong state on every one of them.

> **Decide the name before this phase, not before phase 10.** The Expo scaffold is where
> `ios.bundleIdentifier` and `android.package` get written, and those are permanent after
> publish. See "The actual blocker" below.

**Phase 8 — React Native primitives and screens.** Rewrite the **12** `apps/web/src/ui/`
primitives in `StyleSheet` + a `useColors()` theme context (React Native has no cascading
CSS variables, so dark mode is the one real architecture change). Domain screens in
`cards/`, `pods/`, `pairings/` and `swiss/` port as copy-paste starting points — their JSX
survives, their Tailwind strings do not. `Sheet`, `CoinFlip` and `DieRoller` are the only
non-mechanical rewrites.

Routing is already shaped for this: `packages/core/src/navigation/navigation.ts` maps each
screen 1:1 onto a future Expo Router path, and the picker owns `/cards` distinctly from the
bare root `/` (the root is the cold-launch redirect to the last-used card; `/cards` is
where Back and the Cards tab land, and it survives a refresh).

**Phase 9 — Maestro flows and EAS.** Keep mobile end-to-end on `workflow_dispatch`, not
on pushes: `render.yaml` uses `autoDeployTrigger: checksPass`, which waits on *every*
check, so a flaky emulator would block web deploys.

**Phase 10 — Store submission.** Assets, listings, privacy questionnaires.

## The actual blocker, and it is not code

**Google Play requires 12 testers opted in continuously for 14 days** before a personal
developer account gets production access. That is calendar time; nothing in phases 7–9
shortens it. Apple enrolment ($99/yr) is usually 24–48h. **Start both now**, in parallel
with phase 7 — starting them at phase 10 instead adds two weeks to the finish, and
recruiting twelve real testers is usually the slow half.

**The name is unresolved and becomes permanent on publish.** The repo is `mtg-calc`, the
git remote is `edh-companion`, the Render service is `mtg-calc`, and the app header says
"Commander's Companion". Bundle identifiers cannot be changed afterwards without a new
listing — and phase 7 is where they get chosen, so this is not a phase-10 problem.

**Wizards' Fan Content Policy** permits the verbatim Oracle text every card module carries,
but only for non-commercial fan content: ship free, no ads, no IAP, with the standard
disclaimer in an About screen and both store listings. Wizards' own logos and trademarks
stay out, and nothing may amount to a proxy.

**Card images are permitted**, which an earlier version of this file got wrong by being
cautious rather than by checking. Scryfall serves its image database specifically for
building Magic software under that policy, on terms this app has to keep meeting: do not
crop or cover the copyright and artist line, do not distort or recolor, no watermarks over
the top, and nothing implying anyone other than Wizards created the card. Showing the
**full** card image satisfies all of them at once. Those rules live in
`packages/core/src/cardImage.ts`, next to the code that builds the URL, so they are found
by anyone changing it -- including the one recorded exception: Comet's screen draws the
live loyalty over the card's printed loyalty box (never the art or the artist line), a
deliberate user decision noted there with its rationale and its one-component rollback.

## Decisions already made

Recorded so they are not re-litigated:

- **Expo/React Native**, not Capacitor — a webview wrapper risks Apple's Guideline 4.2
  rejection for a thin repackaged website, and throws away the portability work.
- **Compute ported to TypeScript**, with Python as the source of truth and a generated
  corpus proving they agree. Mobile never calls the backend, which removes CORS, a base
  URL, and the impossibility of forcing a shipped app to update.
- **npm workspaces**, not pnpm — Metro has a long history of choking on pnpm's symlinks.
- **Commander pods**: minimum 3, ideal 4, maximise fours. N=5 seats all five at one table
  rather than benching anyone; there are no byes in Commander. Winner-plus-draw scoring at
  3/1/0. Event format affects only round-1 seeding and whether the field is podded.
- **Practical bounds**: past a million of anything the exact figure has stopped mattering.
  `backend/tests/test_practical_bounds.py` enforces it.
- **The Pairings tab opens on a chooser**, not on Swiss setup — casual pods are the common
  case and Swiss is the specialist one.
- **Cardless entries are a supported shape**, not a workaround. `scryfall_id` is nullable,
  and `test_registry.py` allowlists format-mechanic ids explicitly via
  `_FORMAT_MECHANIC_IDS`, so a *real* card added without an id still fails the check
  instead of hiding among them.
- **Reduced motion shortens reveals rather than collapsing them.** The coin flip and die
  roll are the documented exception to the collapse-to-zero rule, via
  `motion.revealDuration()`. Written up in `docs/ui/design-tokens.md`.

## Tooling in this repo

Five agents, two skills and a hook live in `.claude/` and load automatically, including in
cloud sessions. Run `/context` to confirm they loaded.

- `rules-checker` — verifies Oracle text and rules interactions before a card is written
- `card-evaluator` — judges whether a candidate card is worth building at all
- `card-interaction-designer` — how a card's play pattern should be represented on screen
- `ui-reviewer` — consistency against the spec docs, and proposals for changing them
- `edge-case-hunter` — inputs where a correct answer is still a broken experience
- `/add-card` — the five-step, two-language card workflow
- `/verify` — the full local gate
- `.claude/hooks/session-start.sh` — see below

## Notes for a cloud session

- **Setup is automatic.** The `SessionStart` hook installs `uv` if missing, runs
  `uv sync` in `backend/`, and runs a root `npm install`, so backend and frontend checks
  work the moment the session starts. It is guarded on `CLAUDE_CODE_REMOTE`, so it does
  nothing on a local machine — a local checkout still installs `uv` by hand
  (`curl -LsSf https://astral.sh/uv/install.sh | sh`).
- `/verify` covers the whole gate. CI runs the same commands, so a green local run means
  a green PR.
- Adding a card requires **both** implementations; the parity suite fails until both
  exist, by design.
- **Finish the job by opening the PR.** Several remote sessions have committed real work
  to a `claude/*` branch and stopped there; the branches sat unnoticed for over two weeks,
  including one carrying a security fix. A commit that never becomes a PR is invisible.
- **Do not put `claude.ai/code/session_...` links in commits or PR bodies.** See
  `CLAUDE.md`; some tooling adds them by default and they must be stripped.
