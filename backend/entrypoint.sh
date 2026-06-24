#!/bin/bash
set -euo pipefail

# Sync dependencies from the lockfile every start.
# This handles the dev case where the host volume overwrites the build-time .venv.
uv sync --frozen --no-dev

# In development, run Alembic migrations automatically on startup.
# In production, migrations must be run explicitly via CI/CD or a pre-deploy step.
if [ "${ENVIRONMENT:-development}" = "development" ]; then
  echo "[entrypoint] Running Alembic migrations..."
  uv run alembic upgrade head
  echo "[entrypoint] Migrations complete."
fi

echo "[entrypoint] Starting uvicorn..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
