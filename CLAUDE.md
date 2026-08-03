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

## Two things that surprise people

- A card needs **both** a Python module and a TypeScript mirror. The parity suite fails
  until both exist, by design — that is a forcing function, not an oversight.
- The backend uses `uv`, which is not preinstalled on a cloud VM. Install it before
  running backend checks: `curl -LsSf https://astral.sh/uv/install.sh | sh`.
