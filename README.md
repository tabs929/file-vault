# Vault — Secure File Storage

A full-stack file storage application with authentication, per-user storage quotas, and direct-to-cloud uploads.

## Live Demo

- **App:** https://file-vault-olive.vercel.app
- **API health:** https://va-7b3e31b92f654089844b66a8c09fbfdd.ecs.us-west-2.on.aws/health

To try it: register an account — email verification is required before uploading files.

## Features

- **Authentication** — Register, log in, log out with JWT session cookies; instant session revocation via token versioning
- **Email verification** — Account activation email required before file uploads are enabled
- **Password reset** — Forgot-password flow with time-limited email link
- **File uploads** — Multi-file queue with per-file progress tracking; browser uploads directly to S3 (API never handles file bytes)
- **File management** — View, sort, download, preview in-browser, and delete uploaded files
- **Storage quotas** — Free (100 MB) and Pro (10 GB) plans; quota enforced atomically at upload confirmation
- **Dark / light mode** — System preference detected on first load; user can override
- **Responsive UI** — Works on mobile (390px) through desktop

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2.0 (async) · Alembic · asyncpg |
| Frontend | Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui |
| Database | PostgreSQL 16 |
| Object Storage | AWS S3 (production) · MinIO (local development) |
| Email | Resend |
| CI/CD | GitHub Actions |
| Hosting | AWS ECS (API) · Vercel (frontend) · AWS RDS (database) |

## Architecture

**Direct-to-S3 uploads.** The API issues a presigned URL valid for 10 minutes; the browser uploads directly to S3. The API is never in the data path, which keeps it stateless and eliminates a bandwidth bottleneck. A two-step request/confirm protocol lets the backend atomically increment `used_bytes` only after the upload succeeds, preventing quota drift from failed or abandoned uploads.

**JWT with token versioning.** Each access token embeds a `token_version` that is checked against the user row on every authenticated request. Incrementing `token_version` (on logout or password reset) instantly invalidates all outstanding tokens for that user — no token blacklist table or TTL wait required.

**Same-origin cookies in production.** The frontend (Vercel) proxies all `/api/*` requests to the backend (AWS ECS) via a Next.js catch-all route handler. This makes cookies first-party from the browser's perspective, avoiding cross-origin cookie restrictions without needing `SameSite=None`.

## Security

- Passwords hashed with Argon2id (CPU-hard, memory-hard)
- JWT sessions with token_version — logout and password reset instantly revoke all tokens
- File access returns 404 on unauthorized requests (IDOR defense — no information leakage)
- S3 presigned URLs expire after 15 minutes; bucket has Block Public Access enabled
- Rate limiting on auth endpoints (5 requests/minute per IP)
- Email verification required before file uploads are enabled

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)

### Local Development

```bash
# 1. Clone and configure environment
git clone https://github.com/tabs929/file-vault
cd file-vault
cp .env.example .env
# Edit .env and fill in your values — see .env.example for descriptions of each variable

# 2. Start all services (postgres, minio, api, web)
docker compose up --build
```

The API runs Alembic migrations automatically on startup in development mode.

**Seed subscription plans** (one-time, run after first boot):

```bash
docker compose exec api uv run python -m scripts.seed_plans
```

Services available at:

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| MinIO Console | http://localhost:9001 |

### Running Tests

```bash
docker compose exec api uv run pytest -v
```

Tests cover registration, login, logout, token revocation, rate limiting, email verification, password reset, file upload/download/delete, and quota enforcement.

## Project Structure

```
/
├── backend/
│   ├── app/
│   │   ├── main.py                     # App factory, lifespan, CORS
│   │   ├── core/
│   │   │   ├── config.py               # pydantic-settings (all env vars)
│   │   │   ├── database.py             # Async engine + session factory
│   │   │   ├── security.py             # Argon2 hashing + JWT helpers
│   │   │   ├── auth.py                 # get_current_user dependency
│   │   │   ├── exceptions.py           # Custom errors + handlers
│   │   │   ├── password_blocklist.py   # Common password rejection list
│   │   │   └── rate_limit.py           # slowapi rate limiter
│   │   ├── models/
│   │   │   ├── base.py                 # SQLAlchemy DeclarativeBase
│   │   │   ├── mixins.py               # TimestampMixin (created_at, updated_at)
│   │   │   ├── plan.py
│   │   │   ├── user.py
│   │   │   ├── file.py
│   │   │   └── token.py                # Email verification / reset tokens
│   │   ├── schemas/
│   │   │   ├── auth.py                 # Register / login / user response schemas
│   │   │   └── files.py                # File upload / list schemas
│   │   ├── routers/
│   │   │   ├── auth.py                 # /auth/* endpoints
│   │   │   └── files.py                # /files/* endpoints
│   │   └── services/
│   │       ├── auth_service.py         # Registration + authentication logic
│   │       ├── email_service.py        # Resend email dispatch
│   │       ├── quota_service.py        # Atomic quota check (SELECT FOR UPDATE)
│   │       ├── storage_service.py      # S3 presigned URL generation
│   │       └── token_service.py        # Verification + reset token lifecycle
│   ├── alembic/
│   │   └── versions/
│   │       ├── 0001_initial_schema.py
│   │       ├── 0002_add_user_auth_columns.py
│   │       ├── 0003_add_upload_status_to_files.py
│   │       ├── 0004_add_verification_tokens.py
│   │       └── 0005_add_full_name_to_users.py
│   ├── scripts/
│   │   ├── seed_plans.py               # Inserts free + pro_10 plans (idempotent)
│   │   └── reconcile_quota.py          # Corrects used_bytes drift, purges stale uploads
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_files.py
│   │   └── test_email_features.py
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── entrypoint.sh
│   └── Dockerfile
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout (ThemeProvider, Toaster)
│   │   ├── page.tsx                    # Marketing landing page
│   │   ├── loading.tsx                 # Page transition spinner
│   │   ├── globals.css
│   │   ├── (authenticated)/
│   │   │   ├── loading.tsx
│   │   │   └── dashboard/page.tsx      # Main file manager dashboard
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── auth/verify-email/
│   │   └── api/[...path]/route.ts      # Proxy → backend (same-origin cookies)
│   ├── components/
│   │   ├── auth/auth-card.tsx
│   │   ├── brand/logo.tsx
│   │   ├── dashboard/
│   │   │   └── verification-banner.tsx
│   │   ├── files/
│   │   │   ├── file-list.tsx           # Sortable file table
│   │   │   ├── file-manager.tsx        # Dashboard shell + state
│   │   │   ├── file-preview.tsx        # In-browser file preview
│   │   │   ├── file-row.tsx            # Single file row + action buttons
│   │   │   ├── upload-zone.tsx         # Drag-and-drop upload modal
│   │   │   ├── usage-bar.tsx           # Storage quota bar
│   │   │   └── empty-state.tsx
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── header-background.tsx   # Scroll-aware frosted glass effect
│   │   │   ├── header-logo.tsx         # Logo with scroll-to-top on home
│   │   │   ├── header-user-menu.tsx    # Avatar dropdown (initials, logout)
│   │   │   └── footer.tsx
│   │   ├── theme-provider.tsx
│   │   ├── theme-toggle.tsx
│   │   └── ui/                         # shadcn/ui components
│   ├── lib/
│   │   ├── api.ts                      # Typed fetch client + ApiError class
│   │   ├── auth.ts                     # Client-side auth helpers
│   │   ├── auth-server.ts              # Server-only getCurrentUser (RSC)
│   │   ├── files.ts                    # File API helpers
│   │   └── format.ts                   # formatBytes, planDisplayName
│   ├── middleware.ts                   # Cookie-presence route guard
│   ├── package.json
│   └── Dockerfile
│
├── .github/
│   └── workflows/
│       ├── ci.yml                      # Run backend tests + frontend type check
│       └── deploy.yml                  # Build + push ECR image, deploy to ECS
├── docker-compose.yml
├── .env.example
└── README.md
```

## Deployment

The backend is containerized and runs on **AWS ECS** (Fargate), with **AWS RDS** for PostgreSQL and **AWS S3** for file storage. The frontend is deployed to **Vercel**.

CI runs on every push to `main`: backend pytest suite + frontend TypeScript check. Deployment triggers automatically when CI passes, building a new Docker image, pushing it to **AWS ECR**, and issuing a forced ECS service redeployment.
