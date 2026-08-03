#!/bin/bash
# Bootstraps a Claude Code on the web session so backend and frontend checks
# run immediately, without the session first having to discover that `uv` is
# missing or that dependencies are uninstalled. Idempotent and non-interactive.
set -euo pipefail

# Only bootstrap remote (Claude Code on the web) sessions. A local machine
# already has its own environment set up.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

# The backend uses uv, which is not preinstalled on the cloud VM. Install it if
# it is missing, then make sure it is on PATH for the rest of this hook and for
# the session that follows.
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
fi

# Backend Python deps, including the dev group (ruff, mypy, pytest) that the
# verify gate needs. Builds .venv from backend/uv.lock.
(cd backend && uv sync)

# Frontend workspaces. A root install covers packages/* and apps/* in one pass.
# Chromium is already provided by the environment, so browsers are not fetched.
npm install
