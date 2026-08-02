# Swiss pairings and tiebreakers

Reference for `frontend/src/core/swiss/`. These rules are subtle, easy to misremember,
and expensive to re-derive, so they're written down once here with citations. Verified
against the Magic Tournament Rules on 2026-08-01 — re-check before changing any of it.

Everything below is implemented as pure TypeScript in `frontend/src/core/swiss/`, with
no backend involvement at all. That's deliberate: a tournament runs for hours, the state
is per-device, and pairing a round must not depend on having a signal. It also means the
whole subsystem ports to React Native untouched (see `docs/ui/portability-rules.md`).

## The match model

A `Match` holds a **list** of entrants rather than an A side and a B side:

| `entrantIds.length` | What it is |
|---|---|
| 1 | a bye |
| 2 | an ordinary 1v1 match |
| 3+ | a Commander pod |

`MatchResult.gameWins` is positionally aligned with that list, so who won is *derived*
rather than stored, by a single rule that covers every table size:

> **Sole highest game wins takes the match. Tied at the highest is a draw.**

```
[2, 0]         1v1, 2-0             -> win, loss
[1, 1]         1v1 drawn match      -> draw, draw
[2]            a bye                -> win  (trivially the sole maximum)
[0, 1, 0, 0]   a pod B won          -> loss, win, loss, loss
[0, 0, 0]      a pod that timed out -> draw, draw, draw
```

Two MTR rules then fall out of the model rather than needing a special case: a bye
contributes **no opponent** (there is nobody else in the list), and a pod contributes
**every other player** as an opponent, so beating three people counts three opponents
toward OMW%.

`storage.ts` migrates tournaments saved in the older two-sided shape, so an event in
progress survives the upgrade.

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

## Event formats

`eventFormat` affects exactly two things: how round 1 is seeded, and whether the field
is split into pods at all. Scoring, tiebreakers, drops and re-pairing are identical
throughout.

| Format | Round 1 | Later rounds |
|---|---|---|
| `draft` | draft seating | 1v1 Swiss |
| `sealed` | random | 1v1 Swiss |
| `constructed` | random | 1v1 Swiss |
| `commander` | pods, by seat order or random | pods |

Commander is forced to best-of-one, since a pod is a single game.

## Commander pods

Minimum pod size 3, ideal 4 — so maximise fours and make up the remainder with threes.
Every count from 3 up is expressible as 4a + 3b **except 5**, which becomes a single pod
of five. **There are no byes in Commander**: a table of three is a perfectly good game,
so nobody sits out at any field size.

```
 3  [3]        7  [4,3]      11  [4,4,3]     15  [4,4,4,3]
 4  [4]        8  [4,4]      12  [4,4,4]     16  [4,4,4,4]
 5  [5]        9  [3,3,3]    13  [4,3,3,3]
 6  [3,3]     10  [4,3,3]    14  [4,4,3,3]
```

### Pod pairing minimises repeats rather than forbidding them

The objective is deliberately different from 1v1 Swiss. There a repeat is binary, and
the backtracking search either avoids one or reports that it couldn't. Pods burn
pairings far faster — a four-player pod uses six at once — so a perfect assignment
usually **does not exist**, and searching for one would be wasted work.

So `podPairings` walks the standings and fills each seat with the highest-ranked
remaining player who has met the fewest of the pod so far. Taking the highest-ranked
zero-repeat candidate keeps score groups together at the same time.

Worth internalising, because it looks like a bug otherwise: **with 8 players in two pods
of four, a fully fresh round 2 is impossible.** Any new pod of four drawn from two prior
pods must take two from one of them (pigeonhole), and that pair has already met. The
best achievable is a 2+2 split per pod — four repeated pairs — which is what the pairer
produces. Nine players in three pods of three *can* re-pod with no repeats at all, and
it finds that.

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
3. Pair by backtracking search that never repeats a prior opponent. Because the list is
   standings-ordered, trying partners in order means the closest-ranked legal opponent is
   tried first — which is what keeps score groups together and floats the odd player down
   a group, with no explicit score-group bookkeeping.
4. If the field is odd, someone takes a bye, preferring the **lowest-ranked entrant who
   hasn't had one**. That preference is not absolute: a given bye choice can strand the
   remaining players in a set that cannot be paired without a rematch when another
   eligible choice could have been paired cleanly. So candidates are tried in preference
   order and the first that yields a rematch-free pairing wins. No rule is relaxed — the
   bye still goes to someone who hasn't had one whenever that is possible at all.
5. If no rematch-free pairing exists under *any* legal bye (a small pod that has played
   itself out), it retries allowing rematches and reports `hadToRepeatPairing` so the UI
   can say so rather than silently repeating a matchup.

The search is exhaustive, which is fine at pod scale — 8 entrants is a handful of
branches, not a search space.

> Choosing the bye before searching, and never reconsidering, is what the code used to
> do. It could report `hadToRepeatPairing` in an odd field where a rematch-free pairing
> genuinely existed under a different, equally legal bye — telling players a repeat was
> unavoidable when it wasn't.

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

## Swapping two entrants in a round

`swapPairing` exists for when a generated pairing needs a human override. Both affected
matches are **rebuilt** through `makeMatch`/`makeBye` rather than spread from the old
objects, which matters for two reasons that are easy to get wrong:

- **Match ids are derived from their participants** (`a-vs-b`, or `a-vs-bye`), and every
  result lookup is keyed on `(round, matchId)`. Spreading the old match keeps an id
  naming the players who used to be there.
- **A bye must come back already reported** as its 2–0. The UI offers no way to report a
  bye — there's no match to play — so an unreported bye can never be completed, and
  `isRoundComplete` stays false forever. The round deadlocks with no way out.

A real match does still lose its result, because the result described a pairing that no
longer exists.

## Testing

Unit specs cover each function; `swiss.integration.test.ts` covers whole events —
2 to 16 entrants × both formats × five seeds, run to `recommendedRounds`, with every
invariant in `invariants.ts` asserted after each pairing *and* after each round's results
land. That loop (report → pair from those results → report again) is what makes rounds 3+
meaningful, and it is the thing no unit test was reaching.

Everything is seeded via `mulberry32`, so a failure prints a player count and a seed that
reproduce it exactly. Note `seededRng` cycles a fixed list and is only suitable for a
single call site — `shuffle` consumes n−1 draws per call, so across rounds it correlates
and quietly makes a sweep test far weaker than it looks.

The invariant checkers **return violations rather than throwing**, so each one is unit
tested against a deliberately broken tournament in `invariants.test.ts`. A checker only
ever fed valid input returns "no violations" for every case and detects nothing while
looking like it works.

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
