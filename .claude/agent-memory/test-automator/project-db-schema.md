---
name: project-db-schema
description: Hyro database schema summary — tables, migrations, test harness location
metadata:
  type: project
---

Hyro uses Supabase (hosted Postgres). Schema is defined in raw SQL files under `supabase/`. No ORM migrations — plain SQL applied via Supabase Dashboard SQL Editor.

**Why:** Useful for future test additions or schema change reviews.
**How to apply:** Knowing these paths and migration order prevents re-reading everything.

## Schema files (apply in this order)
1. `supabase/schema.sql` — base schema v3, 21 tables, RLS policies, functions, triggers
2. `supabase/migration-mvp.sql` — schema relaxation (nullable FKs + name columns), new RLS policies, SECURITY DEFINER helpers
3. `supabase/migration-c2-c3-pin-bank.sql` — `users.pin_hash`, `users.app_lock_enabled`, `bank_accounts` table
4. `supabase/migration-payment-methods-v1.sql` — `users.payment_methods` JSONB v1 shape, `is_group_co_member()`, `users_select_own_or_peer` policy
5. `supabase/migration-profile-fields.sql` — `users.gender`, `users.payment_methods` column add (v0)

## 21 core tables
users, groups, group_members, rounds, payments, notifications, bills, bill_participants, bill_splits, bill_settlements, invite_links, user_contacts, bank_accounts, bill_comments, recurring_bills, debt_simplifications, plans, user_subscriptions, group_subscriptions, payment_transactions, usage_tracking

## Test harness
`supabase/tests/` — pgTAP SQL tests, ~483 assertions total
- `01-tables.sql` (~230 assertions): table/column existence, types, NOT NULL, defaults
- `02-constraints.sql` (~130 assertions): PKs, FKs, UNIQUEs, CHECK values, seed data
- `03-rls.sql` (~85 assertions): RLS enabled, all policies exist by name, command type
- `04-functions-triggers.sql` (~38 assertions): function existence, SECURITY DEFINER, STABLE, trigger wiring
- `run.sh`: automated runner supporting `--mode supabase` and `--mode docker`
- `README.md`: full setup docs + GitHub Actions CI snippet

## Key design notes
- NestJS connects via SERVICE ROLE KEY (bypasses RLS); RLS is defense-in-depth only
- All money stored as BIGINT (IDR, no decimals)
- Plans seeded: free (0/mo), boss (29000/mo), business (199000/mo)
- Auth trigger: `on_auth_user_created` → `public.handle_new_user()` auto-creates users row on signup
