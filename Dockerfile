# syntax=docker/dockerfile:1

FROM node:24-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim AS backend-build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev
COPY backend/app ./app

FROM python:3.13-slim AS runtime
RUN groupadd --system app && useradd --system --gid app --home /app --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=backend-build --chown=app:app /app/.venv ./.venv
COPY --from=backend-build --chown=app:app /app/app ./app
COPY --from=frontend-build --chown=app:app /frontend/dist ./app/static
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080
USER app
EXPOSE 8080
# Shell form so $PORT is read at container start -- Render injects its own PORT (10000
# by default) and expects the process to bind to it; a plain `docker run` with no PORT
# set falls back to the 8080 default above.
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
