# Arisan Digital Backend (Python / FastAPI)

FastAPI port of the original NestJS backend. Uses Supabase (service-role) as the
data layer, Pydantic for request validation, and APScheduler for the daily cron
jobs.

## Stack
- **FastAPI** + **Uvicorn** — HTTP server (routers ≈ NestJS controllers)
- **Pydantic v2** — request validation (≈ class-validator DTOs)
- **supabase-py** — Postgres / Auth / Storage access
- **APScheduler** — daily scheduled jobs (≈ `@nestjs/schedule`)
- **bcrypt** — PIN hashing
- **pytest** + **httpx** — tests

## Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in Supabase + webhook secrets
```

## Run
```bash
# dev (reload)
uvicorn app.main:app --reload --port 3000
# prod
uvicorn app.main:app --host 0.0.0.0 --port 3000
```
The API is served under the `/api` prefix (e.g. `GET /api/health`). Payment
gateway webhooks live at `/webhooks/xendit` and `/webhooks/midtrans` (no `/api`
prefix), matching the original NestJS routing.

Interactive API docs (FastAPI extra): `http://localhost:3000/docs`.

## Tests
```bash
pytest
```

## Project layout
```
app/
  main.py              # app factory, /api prefix, CORS, webhook mounting, lifespan
  config.py            # env settings (pydantic-settings)
  db.py                # SupabaseService (admin + per-user clients) + query helpers
  deps.py              # auth / roles / plan dependencies (≈ guards)
  scheduler.py         # APScheduler jobs (materialize bills, expire subs, reminders)
  common/              # shared types + utils
  <module>/            # one package per domain module: schemas.py, service.py, router.py
```

## Environment variables
See `.env.example`. Required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
Optional: `PORT`, `FRONTEND_URL`, `XENDIT_WEBHOOK_TOKEN`, `MIDTRANS_SERVER_KEY`,
and `CRON_*` overrides.

## Deployment
The app is a standard ASGI service — deploy it anywhere that runs a Python web
process (Railway, Render, Fly.io, Cloud Run, a VM, etc.). It honours the
platform-provided `$PORT`.

- **Procfile** (Railway / Render / Heroku-style): `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Docker**: `docker build -t arisan-backend . && docker run -p 3000:3000 --env-file .env arisan-backend`

Set the same environment variables in your host's dashboard. Point the
frontend's `VITE_API_URL` at the deployed origin (the API is served under
`/api`, e.g. `https://your-backend.example.com` → frontend calls
`https://your-backend.example.com/api/...`). Configure the payment-gateway
webhooks to call `https://your-backend.example.com/webhooks/xendit` and
`/webhooks/midtrans` (note: NOT under `/api`).

> Note: the daily cron jobs run via APScheduler inside the web process. On
> serverless platforms that don't keep a process alive, run the scheduler
> separately (e.g. a platform cron hitting an internal endpoint, or a worker
> dyno) instead of relying on the in-process scheduler.
