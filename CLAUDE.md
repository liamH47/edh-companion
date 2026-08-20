# Working in this repo

## Never put Claude session URLs anywhere in the repo

Do not add `claude.ai/code/session_...` links to commit messages, PR descriptions, issue
comments, or code. Some tooling adds them by default; strip them.

This repository is **public**, and a session transcript can contain anything pasted during
the conversation, including credentials. A public pointer to a private transcript is one
visibility toggle away from exposing whatever is in it, so the link is not harmless just
because it is not itself a secret.

`Co-Authored-By:` trailers are fine and should stay — that is ordinary attribution and
points at nothing.

## Don't re-ask a decision the user has answered

When specialized agents reach quorum, proceed on the agreed items without re-confirming.
For a genuine fork, ask **once** via `AskUserQuestion`; once the user answers, record the
choice and move forward. Never re-surface the same decision.

This matters most in a resumed or background session — for example one watching a PR. A
re-wake is not a new question. If a design decision already has an answer earlier in the
conversation, treat it as settled rather than asking again.

## Secrets

Set them with `gh secret set NAME` and paste at the prompt, never
`gh secret set NAME --body "..."`, which puts the value in shell history and the
transcript. The same goes for deploy hooks and API keys: do not echo them into a
conversation, a commit, or a log.

## Orientation

- `docs/roadmap.md` — what is built, what is left, and the decisions not to re-litigate
- `docs/ui/` — component spec, screen spec, design tokens, portability rules
- `/verify` — the full local gate; CI runs the same commands, so green locally means a
  green PR
- `/add-card` — adding a card is a five-step job across two languages

## Finish the job by opening the PR

Committing to a `claude/*` branch is not delivery. Several remote sessions have stopped
there, and the branches sat unnoticed for over two weeks — one of them carrying a security
fix. Open the PR before the session ends; a commit nobody can see may as well not exist.

## Three things that surprise people

- A card needs **both** a Python module and a TypeScript mirror. The parity suite fails
  until both exist, by design — that is a forcing function, not an oversight.
- The backend uses `uv`, which is not preinstalled on a cloud VM — but you do not have to
  install it yourself. The `SessionStart` hook (`.claude/hooks/session-start.sh`) installs
  `uv`, runs `uv sync` in `backend/`, and runs a root `npm install`, so checks work
  immediately. It is guarded on `CLAUDE_CODE_REMOTE` and does nothing locally, so a local
  checkout still needs `curl -LsSf https://astral.sh/uv/install.sh | sh` by hand.
- Not every entry under Cards is a card. Commander Tax is a format mechanic with
  `scryfall_id: None`, and `test_registry.py` allowlists such ids explicitly — so a real
  card added without an id still fails the check.
