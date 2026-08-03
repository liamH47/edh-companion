# Roadmap

Where this project is and what is left. Written into the repo deliberately: a Claude Code
cloud session clones the repo and cannot see anything on a local machine, so a plan that
lives only in `~/.claude/plans/` is invisible there.

Last updated 2026-08-03.

## Where it stands

The web app is **complete and deployed** at <https://mtg-calc.onrender.com>, and works
entirely offline — card metadata is bundled and compute runs in the browser, so no tab
needs a connection.

- **11 cards**, each a Python module plus a mirrored TypeScript implementation
- **Swiss pairings** with 1v1 and Commander pods, drops, re-pairing, and MTR tiebreakers
- **Coin flip** with Okaun/Zndrsplt tracking
- Every deploy gated on CI: backend lint/types/tests, both frontend packages at 100%
  coverage, a parity corpus proving Python and TypeScript agree, and Playwright end-to-end
  against the real Docker image

Nothing is half-finished. There is no broken state to return to.

## Layout

```
apps/web/            the React web app (Vite, Tailwind v4)
packages/core/       platform-free logic + design tokens -- no DOM, enforced by tsconfig
backend/             FastAPI: serves the SPA, publishes /api/cards, owns card behaviour
e2e/                 Playwright, run against the built Docker image
.claude/             four agents and two skills, shared via the repo
```

## What is left

All of it is the mobile port. See `docs/ui/portability-rules.md` for why the split above
makes this cheap.

**Phase 7 — Expo scaffold and platform seams.** `packages/core` already exposes settable
backends for storage, reduced-motion, haptics, sound and compute; `apps/web/src/platform.ts`
is the web half. A native app needs the same file with MMKV, `AccessibilityInfo`,
`expo-haptics` and `expo-audio`. **Storage must stay synchronous** — three call sites read
during render — which is why MMKV rather than AsyncStorage.

**Phase 8 — React Native primitives and screens.** Rewrite the 11 `apps/web/src/ui/`
primitives in `StyleSheet` + a `useColors()` theme context (React Native has no cascading
CSS variables, so dark mode is the one real architecture change). Domain screens in
`cards/` and `swiss/` port as copy-paste starting points — their JSX survives, their
Tailwind strings do not. `Sheet` and `CoinFlip` are the only non-mechanical rewrites.

**Phase 9 — Maestro flows and EAS.** Keep mobile end-to-end on `workflow_dispatch`, not
on pushes: `render.yaml` uses `autoDeployTrigger: checksPass`, which waits on *every*
check, so a flaky emulator would block web deploys.

**Phase 10 — Store submission.** Assets, listings, privacy questionnaires.

## The actual blocker, and it is not code

**Google Play requires 12 testers opted in continuously for 14 days** before a personal
developer account gets production access. That is calendar time; nothing in phases 7–9
shortens it. Apple enrolment ($99/yr) is usually 24–48h. Both should start well before the
app is ready or they gate the finish.

**The name is unresolved and becomes permanent on publish.** The repo is `mtg-calc`, the
git remote is `edh-companion`, the Render service is `mtg-calc`, and the app header says
"Commander's Companion". Bundle identifiers cannot be changed afterwards without a new
listing.

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
by anyone changing it.

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

## Tooling in this repo

Four agents and two skills live in `.claude/` and load automatically, including in cloud
sessions. Run `/context` to confirm they loaded.

- `rules-checker` — verifies Oracle text and rules interactions before a card is written
- `card-evaluator` — judges whether a candidate card is worth building at all
- `ui-reviewer` — consistency against the spec docs, and proposals for changing them
- `edge-case-hunter` — inputs where a correct answer is still a broken experience
- `/add-card` — the five-step, two-language card workflow
- `/verify` — the full local gate

## Notes for a cloud session

- The backend uses `uv`. If it is not on the machine, install it before running backend
  checks (`curl -LsSf https://astral.sh/uv/install.sh | sh`).
- `/verify` covers the whole gate. CI runs the same commands, so a green local run means
  a green PR.
- Adding a card requires **both** implementations; the parity suite fails until both
  exist, by design.
