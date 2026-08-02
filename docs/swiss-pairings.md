# Swiss pairings and tiebreakers

Reference for `frontend/src/core/swiss/`. These rules are subtle, easy to misremember,
and expensive to re-derive, so they're written down once here with citations. Verified
against the Magic Tournament Rules on 2026-08-01 — re-check before changing any of it.

Everything below is implemented as pure TypeScript in `frontend/src/core/swiss/`, with
no backend involvement at all. That's deliberate: a tournament runs for hours, the state
is per-device, and pairing a round must not depend on having a signal. It also means the
whole subsystem ports to React Native untouched (see `docs/ui/portability-rules.md`).

## Scoring

| Outcome | Match points | Game points |
|---|---|---|
| Match win | 3 | — |
| Match draw | 1 | — |
| Match loss | 0 | — |
| Game win | — | 3 |
| Game draw | — | 1 |
| Game loss | — | 0 |

A **bye** counts as "having won the match 2–0": 3 match points and 6 game points over
2 games. Crucially, a bye contributes **no opponent**, so it is excluded from that
player's opponents' percentages ([MTR Appendix C][appc]).

Implemented in `scoring.ts` (`matchPointsFor`, `gameTallyFor`). Matches with no reported
result count toward nobody's record — an unplayed round doesn't drag anyone down.

## The four tiebreakers, in order

1. **Match points**
2. **OMW%** — opponents' match-win percentage
3. **GW%** — the player's own game-win percentage
4. **OGW%** — opponents' game-win percentage

```
MW%  = match points ÷ (3 × matches played)      floored at ⅓
GW%  = game points  ÷ (3 × games played)        floored at ⅓
OMW% = mean of each opponent's MW%              (byes excluded)
OGW% = mean of each opponent's GW%              (byes excluded)
```

The **⅓ floor lives inside MW% and GW% themselves**, so OMW%/OGW% average values that
are already floored. That's what stops one disastrous opponent from dragging a player's
tiebreakers down out of proportion. The MTR writes the floor as "0.33"; MTGO and most
software use a true third, which is what `MINIMUM_WIN_PERCENTAGE` uses — at pod scale
the two can never produce a different ordering.

With no completed rounds (or no opponents), the floor stands in rather than dividing by
zero. `computeStandings` breaks any remaining tie by seat, so the order is deterministic
instead of depending on array order.

## Round 1: draft seating

Seat `i` plays seat `i + floor(N/2)` — the players sitting furthest apart in the pod,
who passed each other the fewest cards and so have seen least of each other's decks.

- 6-pod → 1v4, 2v5, 3v6
- 8-pod → 1v5, 2v6, 3v7, 4v8
- odd pod → the last seat takes the bye

Sealed has no meaningful draft seating, so `randomFirstRoundPairings` is offered instead.

## Round 2 onward

`swissPairings` in `pairing.ts`:

1. Filter to entrants still in for this round (see **Drops** below).
2. Order by standings, with ties broken **randomly** rather than by seat — a shuffled
   list sorted on only the four real tiebreakers, relying on `Array.sort` being stable
   (ES2019+). Using the final rank directly would make every pairing a fixed function of
   the results, and the same two players would meet over and over in a small pod.
3. If the field is odd, the bye goes to the **lowest-ranked entrant who hasn't had one**.
4. Pair the rest by backtracking search that never repeats a prior opponent. Because the
   list is standings-ordered, trying partners in order means the closest-ranked legal
   opponent is tried first — which is what keeps score groups together and floats the odd
   player down a group, with no explicit score-group bookkeeping.
5. If no rematch-free pairing exists at all (a small pod that has played itself out), it
   retries allowing rematches and reports `hadToRepeatPairing` so the UI can say so
   rather than silently repeating a matchup.

The search is exhaustive, which is fine at pod scale — 8 entrants is a handful of
branches, not a search space.

## Drops

`droppedAfterRound: N` means the entrant played through round N and is out from N+1.
They stop being paired but **keep counting in everyone else's tiebreakers**, because the
matches they played really happened.

## Editing a reported result

Standings are always **derived**, never stored, so correcting a result updates every
tiebreaker immediately with nothing to invalidate.

Rounds already generated from that result are a separate question, and the user chooses:

- **Keep pairings** — what real tournament software does. People may already be playing;
  only rounds not yet generated use the corrected data.
- **Re-pair from round N** — `repairRoundsFrom` discards every later round and rebuilds
  them from the corrected standings.

## Round counts

[MTR Appendix E][appe] recommends:

| Players | Swiss rounds |
|---|---|
| 5–8 | (single elimination, 3 rounds) |
| 9–16 | 4–5 |
| 17–32 | 5 |
| 33–64 | 6 |
| 65–128 | 7 |

`recommendedRounds` follows this from 9 players up. Below that the MTR suggests single
elimination, but **3 rounds of Swiss is what a draft pod actually plays**, so that's the
default — the app is for a kitchen table, not a Grand Prix.

## Two-Headed Giant

Modeled by giving an `Entrant` two `members` rather than by branching anywhere in the
pairing or scoring code: a 2HG "team" is one seat with one record, which is exactly what
an `Entrant` already is. 2HG is always best-of-one, which `createTournament` enforces.

[appc]: https://blogs.magicjudges.org/rules/mtr-appendix-c/
[appe]: https://blogs.magicjudges.org/rules/mtr-appendix-e/
