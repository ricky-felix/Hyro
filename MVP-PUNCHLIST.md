# Hyro — MVP Completion Punch-List

> Status as of 2026-06-08. Audited against `frontend/src/pages` + `backend/src/*` controllers.
> Backend is feature-complete and tested; the gaps below are **frontend pages, upload flows, the CRON layer, real auth, and the frontend↔backend integration**.

Effort scale: S = ≤1 day, M = 2–3 days, L = 4–6 days, XL = 1.5–2 weeks.

---

## ✅ Wave 1 — DONE (2026-06-08, 3 concurrent agents)

- **C1 CRON** — `backend/src/scheduler/` added (`@nestjs/schedule@4.1.2`); daily jobs call `RecurringBillsService.materializeDue()` (06:00) and `SubscriptionsService.expireDue()` (06:15), env-overridable, try/catch + Logger. Backend build green.
- **Workstream A pages** — 8 new pages built + routed + Profil handlers rewired: EditProfil, MetodePembayaran, KeamananPin, Bantuan, Bahasa, RiwayatTransaksi, Onboarding, RekeningPayout. Frontend build green.
- **Workstream D integration** — 9 screens wired to the services layer via 9 new hooks in `src/hooks/`; loading/error/empty states; static `data.js` kept as fallback. Frontend build green.
- **Seam fixed by main:** added `:id` param routes for `/app/grup`, `/app/anggota`, `/app/undang`.

### ⚠️ Wave 1 follow-up (must do before D actually works at runtime)
- **Service endpoint drift** — `services/groups.service.js` (written May) targets stale paths. Compiles, but 404s at runtime:
  - invites: service `/invite-links/*` + `validate`/`join` → backend is `/invites` + `/invites/redeem/:token`
  - rounds: service `/rounds/group/:id/current` + `/draw` → backend is `/groups/:id/rounds` + `/rounds/:id/activate|complete`
  - giliran: service `PATCH /members/:id/giliran` → backend `POST /members/assign-giliran`
- **Runtime verification pending** — builds pass but no agent could run against a live backend + Supabase env. Needs a real smoke test once endpoints are reconciled.

---

## ✅ Wave 2 + C4 — DONE

- **C2/C3 backend** — PIN (`/users/me/pin`, `/pin/verify`, `/security`) + bank account (`/users/me/bank-account`) endpoints, bcrypt, DTOs; migration `supabase/migration-c2-c3-pin-bank.sql` (targets `public.users` + new `bank_accounts` table w/ RLS).
- **B uploads + A wiring** — `useUpload` hook; KeamananPin, RekeningPayout, EditProfil (incl. avatar), RiwayatTransaksi, BuktiTransfer (proof) wired to real endpoints; `transactionsService` added.
- **Storage contract fix (main)** — `useUpload`/`storage.service` rewritten to match the REAL backend (`{bucket,path,signed_url,token}` + Supabase `uploadToSignedUrl`); ApiClient `delete()` now sends a body; delete path fixed to `DELETE /storage/object`. New `supabase/migration-storage-buckets.sql` creates the `avatars`/`receipts`/`payment-proofs` buckets + RLS.
- **C4 real auth** — anonymous auth REMOVED; require login. Email **or** phone + password (single identifier, no OTP). `/masuk` route, `ProtectedRoute` redirect w/ `returnTo` (invite deep-links survive login), Profil logout, account-prompt neutralized. Identifier parser normalizes phone to `+62` E.164.
- **Reminder CRON** — `NotificationsService.createPaymentReminders()` + daily `send-payment-reminders` job (arisan rounds due ≤24h/overdue & unpaid; pending patungan settlements), idempotent via metadata check.

### 🔧 Manual steps the owner must do (app won't fully run otherwise)
1. **Apply 3 migrations** in Supabase: `migration-c2-c3-pin-bank.sql`, `migration-storage-buckets.sql` (+ confirm base `schema.sql`/`migration-mvp.sql` applied).
2. **Supabase Auth → Providers:** enable **Email** + **Phone**; **DISABLE "Confirm phone"** (else phone signup needs paid SMS); choose email-confirmation on/off (off = instant login).
3. Disable the Anonymous provider (no longer used).

### ⏳ Remaining polish (optional, no decisions needed)
- Avatar/proof URLs expire (private buckets) → persist `path` + resolve signed URL on render, OR make `avatars` public.
- QR decode still mocked in `GabungMasuk` (real jsQR/zxing).
- Bundle code-splitting (1.15MB single chunk → lazy routes).
- Reminder idempotency hardening (`dedup_key UNIQUE` column).
- Optional public invite-preview endpoint (pre-auth group preview).
- Runtime smoke test against live backend + Supabase.

---

## Workstream A — Missing secondary pages (don't exist at all)

These are wired to `toast("… segera hadir")` in `Profil.jsx` with no route/file behind them.

| # | Page | New route | Maps to backend | Backend ready? | Effort |
|---|------|-----------|-----------------|----------------|--------|
| A1 | **Edit Profil** (name, phone, photo) | `/app/profil/edit` | `GET /users/me`, `PATCH /users/me` | ✅ yes | M |
| A2 | **Metode Pembayaran** (payment method) | `/app/profil/pembayaran` | Xendit/Midtrans checkout + `GET /subscriptions/me` | ⚠️ partial — no stored-card endpoint; uses gateway redirect | M |
| A3 | **Keamanan & PIN** (set/change PIN, app lock) | `/app/profil/keamanan` | ❌ **needs new** `PATCH /users/me/pin` + PIN verify | ❌ backend work required | M |
| A4 | **Bantuan** (help / FAQ / contact) | `/app/profil/bantuan` | static content (reuse landing `FAQs`) | n/a (static) | S |
| A5 | **Bahasa** (language) — optional | `/app/profil/bahasa` | local pref only | n/a | S |
| A6 | **Riwayat Transaksi** (payment history) | `/app/riwayat` | `GET /transactions/me`, `GET /payments/me`, `GET /settlements/me` | ✅ yes | M |
| A7 | **Onboarding / intro** (first-run tutorial) | `/app/onboarding` | local flag only | n/a | M |
| A8 | **Rekening / Payout setup** (bank account for receiving) | `/app/profil/rekening` | ❌ **needs new** bank-account CRUD on `users` | ❌ backend work required | M |

**Subtotal: ~3 weeks** (A4/A5 are quick; A3 + A8 carry backend work).

---

## Workstream B — Upload / image flows (no real upload exists anywhere)

Backend `storage` module + frontend `storage.service.js` (presigned URLs) both exist but are **imported by nothing**.

| # | Flow | Where | Maps to backend | Effort |
|---|------|-------|-----------------|--------|
| B1 | **Avatar / profile photo upload** | inside A1 Edit Profil | `POST /storage/upload-url` → PUT to URL → `PATCH /users/me` | M |
| B2 | **Proof-of-transfer photo upload** | `BuktiTransfer.jsx` (today only *generates* a receipt, never uploads) | `POST /storage/upload-url` → attach to `POST /payments` or `POST /settlements` | M |
| B3 | **Wire `storage.service.js`** into the app (shared uploader hook/component) | new `useUpload()` hook | `POST /storage/upload-url`, `POST /storage/read-url`, `DELETE /storage/object` | S |

**Subtotal: ~1 week.**

---

## Workstream C — Backend gaps

| # | Item | What's missing | Work | Effort |
|---|------|----------------|------|--------|
| C1 | **CRON / scheduler** | No `@nestjs/schedule`, no cron, no queue. `POST /recurring-bills/run-due` and `POST /subscriptions/expire-due` exist but **nothing ever calls them**. | Add `ScheduleModule`; daily job → `run-due` (recurring bills) + reminders; daily → `expire-due` (subscription expiry). Add retry/logging. | M–L |
| C2 | **PIN backend** (for A3) | No PIN field/endpoints on `users` | Add hashed `pin` column + `PATCH /users/me/pin` + verify guard | M |
| C3 | **Payout/bank account backend** (for A8) | No bank-account storage | Add table + CRUD endpoints | M |
| C4 | **Real auth** | Anonymous Supabase session; `LoginOrRegister` stubbed | Email/phone signup, link existing members, update RLS to real `user.id` | XL |

**Subtotal: ~3–4 weeks** (C4 dominates).

---

## Workstream D — Integration: wire existing screens to the backend

Every routed v2 screen runs on a static `components/application/v2/<area>/data.js`. The `services/*` layer (real `ApiClient`) is fully written but **unimported**. Replace each static import with the matching service call + loading/error/empty states.

| # | Screen | Replace static `data.js` with | Maps to backend |
|---|--------|-------------------------------|-----------------|
| D1 | `HomeDeck` (`home/data`) | groups + bills feed | `GET /groups`, `GET /bills` |
| D2 | `BuatArisan` (uses `mockData`) | create group/round | `POST /groups`, `POST /rounds` |
| D3 | `BuatPatungan` (uses `mockData`) | create bill + participants | `POST /bills`, `bill-participants` |
| D4 | `GroupDetail` (`grup/data`) | group detail + members | `GET /groups/:id`, `group-members` |
| D5 | `MembersOrbit` (`members/data`) | member/contact list | `GET /contacts`, `group-members` |
| D6 | `Notifikasi` (`notifikasi/data`) | notifications | `GET /notifications`, `/unread-count`, `POST /:id/read`, `/read-all` |
| D7 | `Dompet` (`dompet/data`) | plan/usage/subscription | `GET /plans`, `GET /subscriptions/me`, usage |
| D8 | `Undang` / `GabungMasuk` / `Gabung` | invite create + redeem (QR decode is mocked) | `POST /invites`, `POST /invites/redeem/:token` |
| D9 | `BuktiTransfer` | settlement/payment confirm | `POST /settlements`, `POST /payments`, `PATCH .../confirm` |

**Subtotal: ~2 weeks** for all nine screens incl. loading/error/empty states.

---

## Suggested sequencing

1. **Foundations first** — C4 real auth + D (wire screens to backend). Without these the app doesn't persist anything; everything else sits on sand. *(~4 weeks)*
2. **CRON (C1)** — turns recurring bills, reminders, and subscription expiry from dead endpoints into live behavior. *(~1 week)*
3. **Upload flows (B)** + **Edit Profil/avatar (A1)** — high-visibility, share infra. *(~1 week)*
4. **Settings cluster (A2–A5) + Riwayat (A6)** + their backend bits (C2, C3). *(~2 weeks)*
5. **Onboarding (A7) + Payout (A8)** — growth/retention polish. *(~1 week)*

**Total to a genuinely complete, backed MVP: ~8–9 weeks of focused work.**

---

## One-line gap summary
- **8 pages that don't exist** (settings cluster, history, onboarding, payout)
- **3 upload flows** with zero real upload code despite a ready backend
- **0 scheduled jobs** — two "run-due" endpoints nothing calls
- **9 screens** running on static mock data, disconnected from a complete backend
- **No real auth** — anonymous sessions only
