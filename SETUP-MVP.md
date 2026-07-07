# Hyro — MVP setup (no login, Supabase-backed)

This MVP runs **without a login/registration screen**. Each visitor gets an
anonymous Supabase session automatically, and all data (arisan groups,
members, giliran, payments, patungan bills & splits) is persisted in Supabase.
Members and participants are stored as plain **names** — no separate accounts.

The login/registration pages are kept in the codebase (`src/pages/LoginOrRegister.jsx`,
`src/components/auth/*`) but are not used in the current flow.

## One-time setup (2 steps in the Supabase dashboard)

### 1. Enable Anonymous auth
Supabase Dashboard → **Authentication → Sign In / Providers → Anonymous** → toggle **on**.
Without this the app shows a "Perlu satu langkah setup" screen.

### 2. Run the migration
Supabase Dashboard → **SQL Editor** → paste the contents of
[`supabase/migration-mvp.sql`](supabase/migration-mvp.sql) → **Run**.

It:
- relaxes `group_members` / `bill_participants` / `bill_splits` so members can be names,
- fixes the **infinite-recursion** bug in the original RLS policies, and
- adds the INSERT/UPDATE/DELETE policies a browser client needs.

It is idempotent — safe to re-run.

## Verify it works

```bash
cd frontend
node scripts/verify-supabase.mjs
```

This signs in anonymously and runs the real create/read flows for both modules,
then cleans up. All checks should print ✓.

## Run the app

```bash
cd frontend
npm install
npm run dev
```

Open the app, click **Coba Sekarang** on the landing page (or go to `/app`).
You start with an empty dashboard and can create your first arisan or patungan.

## Environment

`frontend/.env` needs:

```
VITE_SUPABASE_URL=...            # your project URL
VITE_SUPABASE_PUBLISHABLE_KEY=...# anon/publishable key (safe for the browser)
```

> ⚠️ Do **not** reference `VITE_SUPABASE_SECRET_KEY` in frontend code — anything
> with a `VITE_` prefix is bundled into the client. The service key must stay
> server-side only.

## What's implemented

| Area | Status |
|------|--------|
| Anonymous session + editable guest profile | ✅ |
| Create arisan (members, frequency, auto giliran schedule) | ✅ |
| Arisan detail (members, giliran timeline, mark paid, complete round, delete) | ✅ |
| Create patungan (equal / exact split, named participants) | ✅ |
| Patungan detail (per-participant settle, progress, delete) | ✅ |
| Payments page (your dues + admin confirm/reject) | ✅ |
| Dashboard aggregates from live data | ✅ |
| Empty states everywhere (no dummy data) | ✅ |
| Invite-link join, recurring bills, notifications, analytics | ⏳ stubbed for later |
