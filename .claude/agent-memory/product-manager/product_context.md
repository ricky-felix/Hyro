---
name: product-context
description: Hyro product overview — target market, vision, core features, business model, and current state
metadata:
  type: project
---

## Product Vision

**Hyro** is a web app to digitize two Indonesian financial traditions for Gen Z:

1. **Arisan** (rotating savings group) — members contribute fixed amounts on a schedule; take turns receiving the full pool
2. **Patungan** (bill splitting) — split shared expenses across friends with 4 methods (equal/exact/percentage/shares)

Target: Gen Z Indonesia. Indonesia-first product (all UI copy in Indonesian by default, English as second language).

## Business Model

Freemium subscription with 3 tiers:
- **Free**: max 2 groups, 5 bills/month
- **Boss** (Rp 29k/mo): more groups, higher bill limits
- **Bisnis** (Rp 199k/mo): unlimited

Monetization gateways: Xendit + Midtrans (webhook validated).

## Tech Stack

**Backend**: NestJS 10 + TypeScript, Supabase PostgreSQL (20 tables, RLS), Jest tests (49 tests, 8 suites all passing).

**Frontend**: React 18 + Vite, Tailwind CSS v4, React Router 7, Framer Motion (landing only). Two UI versions:
- **v1** (legacy, still in codebase): older component library, Arisan/Patungan screens
- **v2** (current): redesigned, token-based design system (emerald=arisan, lavender=patungan), CSS animation, Indonesian route names (`/app/BuatArisan`, `/app/Profil`, etc.)

Database: Supabase PostgreSQL with RLS + service-role auth backend. Service role key server-side only; client uses anon key + signed URLs.

## Current State (as of 2026-06-06)

**MVP Status**: Reached "MVP ready" (commit 0118a42, 2026-05-18). Marked as production-ready core loop.

**Recent work** (last 5 commits):
- Footer placement fix
- Navbar/footer redesign
- Typo fixes
- Password access gate added (`[assword` in commit message suggests typo) + 404 pages
- All on top of MVP baseline

**Frontend build**: ~1.1MB (JS bundle), warning about chunk size >500KB (common for Vite early-stage apps).

**Key Files**:
- `frontend/CLAUDE.md` — strict design conventions (Tailwind→tokens→scoped CSS priority)
- `API_DOCS.md` — full OpenAPI reference (126 endpoints across 18 modules)
- `SETUP-MVP.md` — MVP runs on anonymous Supabase auth, no login gate (members/participants stored as plain names)
- Backend tests all passing

**What's Built**:
- Full arisan (group create, member invites, giliran scheduling, payment tracking, admin approval)
- Full patungan (bill create, 4 split strategies, debt simplification algorithm, settlements)
- Notifications, contacts, recurring bills, storage (signed URLs), billing webhooks, usage tracking, RBAC (platform + group-level)

**What's NOT fully built**:
- Invite-link join (stubbed)
- Analytics/dashboard aggregates (basic home view exists)
- Recurring bills auto-trigger (endpoint exists, not scheduled)
- Push notifications (table/schema ready, not frontend integrated)
- Full subscription flow UI (payment gateways integrated backend, limited frontend)

## Known Gaps & Debt

1. **No real authentication in MVP** — anonymous Supabase auth; login/register pages exist but aren't used. Security model relies on RLS + service role backend.
2. **Chunk size warning** — 1.1MB JS, no code splitting yet. Frontend is early-stage monolithic bundle.
3. **v1 screens still in codebase** — legacy UI kept for backward compat or reference; v2 is the current design direction.
4. **Scheduled jobs** — recurring bills, notifications, analytics cron missing (endpoints exist, not automated).
5. **Payment gateway integration** — webhooks implemented (Xendit, Midtrans), but limited UI flow testing / retry logic.
6. **Analytics** — table exists, no reporting dashboard or user-facing insights yet.
