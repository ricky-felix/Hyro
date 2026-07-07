---
name: arisan-digital-context
description: Core product context for Hyro — Gen-Z Indonesian app for rotating-savings (arisan) & bill-splitting (patungan)
metadata:
  type: project
---

**Product**: Hyro
**Target Users**: Gen-Z Indonesians (18–35) coordinating shared finances via rotating-savings groups and one-off bill splits.
**Current Status**: MVP launched; v2 redesigned UI (React + Vite + Tailwind v4 frontend); NestJS + Supabase backend.
**Business Model**: No money held; members transfer peer-to-peer via bank/e-wallet; app is coordination + proof layer.

## Key Flows
1. **Arisan** (Rotating Savings): Fixed group, monthly/weekly rounds, one member receives pot each round, all pay iuran.
2. **Patungan** (Bill Splitting): One member fronts shared expense, others settle their share via bank transfer.

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS v4 + React Router; v1 legacy frozen, all work in v2 (`/application/v2/`).
- **Backend**: NestJS, Supabase Postgres, RLS policies as secondary safety.
- **Storage**: Private Supabase buckets (avatars, payment-proofs, payment-qris-codes).
- **Auth**: Supabase JWT; all app routes gated by AuthGuard + RolesGuard.

## Current Payment Methods State
- `users.payment_methods`: JSONB field, currently stores `string[]` (e.g., `["qris","gopay","bca"]`).
- Feature lives on `MetodePembayaran.jsx` — toggle list, no account details.
- **Gap**: Users select "I accept BCA" but don't provide account number; payees must ask for details via chat.

## Design System (v2)
- **Arisan → Emerald** (primary color family)
- **Patungan → Lavender** (accent color family)
- CSS priority: Tailwind utilities → global tokens in `index.css` → scoped v2 rules in `app-v2.css`.
- No Framer Motion in app screens; CSS animations only.
- All sub-pages use `ScreenHeader` component (sticky, centered band).
- Indonesian copy/screen names; English code identifiers.

## Key External Endpoints
- `GET /users/me` → fetch profile + payment_methods.
- `PATCH /users/me` → update profile fields including payment_methods.
- `POST /storage/upload-url`, `POST /storage/read-url` → signed image uploads/reads (settlement proofs, QRIS codes).
- Settlement submissions: `POST /bill-settlements` (patungan) or via payments service (arisan).

## File Locations (Important)
- Frontend: `/frontend/src/pages/application/v2/MetodePembayaran.jsx` (will be refactored).
- Backend DTOs: `/backend/src/users/dto/update-user.dto.ts`.
- Database schema: `/supabase/schema.sql`.
- Migrations: `/supabase/migration-profile-fields.sql` (where `payment_methods` column added).
- Service layer: `/frontend/src/services/users.service.js`, `/backend/src/users/users.service.ts`.
- Settlement hooks: `/frontend/src/hooks/useSettlement.js`.
- Upload hook: `/frontend/src/hooks/useUpload.js`.

## Dev Notes
- All user-facing work is v2 only (v1 is frozen).
- Private buckets require signed URLs (expire 1h default); paths are durable; always refresh signed URL on render.
- RLS is secondary; primary auth is NestJS AuthGuard (JWT); RLS acts as backup for safety.
- Storage buckets are private; sensitive data (account numbers, phones) masked to last-4 when shown to group peers.
