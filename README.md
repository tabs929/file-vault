# File Vault

A secure, subscription-aware file storage application.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2.0 (async) · Alembic · asyncpg |
| Frontend | Next.js 15 · App Router · TypeScript · Tailwind CSS |
| Database | PostgreSQL 16 |
| Object Storage | MinIO (local) · AWS S3 (production) |
| Dependency Management | uv (Python) · npm (Node) |

## Local Setup

### Prerequisites

- Docker Desktop (or Docker Engine + Compose v2)
- `uv` — [install](https://docs.astral.sh/uv/getting-started/installation/)

### First-time setup

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. (Optional) Regenerate the Python lockfile if you add new dependencies
#    Must be run from backend/
cd backend && uv lock && cd ..

# 3. Build and start all services
docker compose up --build
```

> **Note on `uv.lock`:** The lockfile is committed for reproducibility.
> If you add or change dependencies in `backend/pyproject.toml`, run
> `cd backend && uv lock` and commit the updated `uv.lock`.

### Seed default subscription plans

The `free` and `pro_10` plans must be seeded once after the database is created.
This is a **manual** step — it is intentionally not run automatically on startup.

```bash
# Run with the api container already up
docker compose exec api uv run python -m scripts.seed_plans
```

The seed script is idempotent (`INSERT ... ON CONFLICT (name) DO NOTHING`).
Re-running it is safe and will not overwrite existing rows.

> **Changing plan quotas:** Re-running the seed script will NOT update existing
> plans. To change a quota, run a manual `UPDATE plans SET quota_bytes = <n>
> WHERE name = '<plan>'` against the database.

### Alembic migrations

In `ENVIRONMENT=development` (the default), Alembic migrations run automatically
when the `api` container starts via `entrypoint.sh`.

To run migrations manually:

```bash
docker compose exec api uv run alembic upgrade head
```

To create a new migration after changing models:

```bash
docker compose exec api uv run alembic revision --autogenerate -m "describe change"
```

## Ports

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |
| MinIO API | http://localhost:9000 |
| MinIO Console | http://localhost:9001 |

## Verification

After `docker compose up --build`, run:

```bash
# 1. Health check
curl http://localhost:8000/health
# Expected: {"status":"ok"}

# 2. Open the frontend
open http://localhost:3000
# Expected: "API Status: ok" displayed on the page

# 3. Confirm tables were created
docker compose exec postgres psql -U filevault -d filevault -c "\dt"
# Expected: plans, users, files tables

# 4. Seed plans (first time only)
docker compose exec api uv run python -m scripts.seed_plans

# 5. Confirm plans were seeded
docker compose exec postgres psql -U filevault -d filevault \
  -c "SELECT name, quota_bytes FROM plans;"
# Expected:
#  name   | quota_bytes
# --------+-------------
#  free   |   104857600
#  pro_10 | 10737418240
```

## Phase Progress

- [x] **Phase 1 — Foundation** (this phase)
  - Monorepo scaffold, Docker Compose, health endpoint, DB schema, plan seed script
- [ ] **Phase 2 — Auth** (register, login, JWT)
- [ ] **Phase 3 — Files & Security** (S3/MinIO uploads, ownership enforcement, quotas)
- [ ] **Phase 4 — Password Reset** (AWS SES)
- [ ] **Phase 5 — Polish & Tests**
- [ ] **Phase 6 — Deploy to AWS** (App Runner, RDS, S3, Vercel)
- [ ] **Phase 7 — Stretch: Terraform**

## Project Structure

```
/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py             # App factory, lifespan, CORS, /health
│   │   ├── core/
│   │   │   ├── config.py       # pydantic-settings (all env vars)
│   │   │   └── database.py     # Async engine + session factory
│   │   ├── models/
│   │   │   ├── base.py         # DeclarativeBase
│   │   │   ├── mixins.py       # TimestampMixin (created_at, updated_at)
│   │   │   ├── plan.py
│   │   │   ├── user.py
│   │   │   └── file.py
│   │   ├── schemas/            # Pydantic schemas (Phase 2+)
│   │   ├── routers/            # API routers (Phase 2+)
│   │   └── services/           # Business logic (Phase 2+)
│   ├── alembic/                # Migration environment
│   │   └── versions/
│   │       └── 0001_initial_schema.py
│   ├── scripts/
│   │   └── seed_plans.py       # Manual plan seeder
│   ├── tests/
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── entrypoint.sh
│   └── Dockerfile
│
├── frontend/                   # Next.js 15 frontend
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Homepage — shows API status
│   │   └── globals.css
│   ├── lib/
│   │   └── api.ts              # Typed fetch helpers
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```
