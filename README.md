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

### Frontend dependency changes (Docker)

The `web` service uses an anonymous volume for `/app/node_modules`. After adding or
removing npm packages, `docker compose restart web` alone is not enough — the
stale volume will keep old modules.

```bash
docker compose down
docker compose build --no-cache web
docker compose up
```

If problems persist, also prune the builder cache before rebuilding:

```bash
docker builder prune -f
docker compose down
docker compose build --no-cache web
docker compose up
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

# 2. Seed plans (first time only)
docker compose exec api uv run python -m scripts.seed_plans

# 3. Backend auth tests (requires Postgres; create test DB once)
docker compose exec postgres psql -U filevault -c "CREATE DATABASE filevault_test;" 2>/dev/null || true
cd backend && uv run pytest -v

# 4. Manual UI flow
open http://localhost:3000/register
# Register → redirected to /login with success toast
# Sign in → redirected to /dashboard; header shows email + avatar
# Dashboard shows plan, used, quota stats
# Logout → redirected to /login; old session cookie returns 401 on /auth/me
# /dashboard without cookie → redirected to /login (middleware)
# 5 failed login attempts → alert with forgot-password link
# 6th login attempt within a minute → rate-limit toast
```

### Auth API smoke tests (optional)

```bash
# Register
curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"unique-password-123","plan_name":"free"}'

# Login (saves session cookie)
curl -s -c /tmp/vault-cookies -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"unique-password-123"}'

# Current user
curl -s -b /tmp/vault-cookies http://localhost:8000/auth/me

# Logout
curl -s -b /tmp/vault-cookies -c /tmp/vault-cookies -X POST http://localhost:8000/auth/logout
```

## Phase Progress

- [x] **Phase 1 — Foundation**
  - Monorepo scaffold, Docker Compose, health endpoint, DB schema, plan seed script
- [x] **Phase 2 — Auth**
  - Register, login, logout, JWT session cookie, token revocation, rate limiting, auth UI
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
│   │   ├── main.py             # App factory, lifespan, CORS, auth router
│   │   ├── core/
│   │   │   ├── config.py       # pydantic-settings (all env vars)
│   │   │   ├── database.py     # Async engine + session factory
│   │   │   ├── security.py     # Argon2 + JWT helpers
│   │   │   ├── auth.py         # get_current_user dependency
│   │   │   ├── exceptions.py   # Custom errors + handlers
│   │   │   ├── password_blocklist.py
│   │   │   └── rate_limit.py   # slowapi limiter
│   │   ├── models/
│   │   │   ├── base.py         # DeclarativeBase
│   │   │   ├── mixins.py       # TimestampMixin (created_at, updated_at)
│   │   │   ├── plan.py
│   │   │   ├── user.py
│   │   │   └── file.py
│   │   ├── schemas/
│   │   │   └── auth.py         # Register/Login/UserResponse schemas
│   │   ├── routers/
│   │   │   └── auth.py         # /auth/* endpoints
│   │   └── services/
│   │       └── auth_service.py # register + authenticate logic
│   ├── alembic/                # Migration environment
│   │   └── versions/
│   │       ├── 0001_initial_schema.py
│   │       └── 0002_add_user_auth_columns.py
│   ├── scripts/
│   │   └── seed_plans.py       # Manual plan seeder
│   ├── tests/
│   │   ├── conftest.py
│   │   └── test_auth.py
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── entrypoint.sh
│   └── Dockerfile
│
├── frontend/                   # Next.js 15 frontend
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Marketing homepage
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── (authenticated)/dashboard/page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── auth/auth-card.tsx
│   │   └── layout/header.tsx
│   ├── lib/
│   │   ├── api.ts              # Typed fetch helpers (credentials: include)
│   │   ├── auth.ts             # Client auth helpers
│   │   └── auth-server.ts      # Server-only getCurrentUser
│   ├── middleware.ts           # Cookie-presence route guard
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```
