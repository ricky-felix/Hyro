# Hyro — Database Tests (pgTAP)

## Overview

This directory contains the pgTAP test suite for the Hyro Supabase/Postgres schema. Every assertion is derived directly from `supabase/schema.sql` and the migration files — no tables or columns are invented.

| File | What it tests | Approx. assertions |
|------|---------------|-------------------|
| `01-tables.sql` | Table existence, column existence, column types, NOT NULL, defaults | ~230 |
| `02-constraints.sql` | Primary keys, foreign keys, UNIQUE constraints, CHECK values, seed data | ~130 |
| `03-rls.sql` | RLS enabled on every table, policy existence by name, policy command type | ~85 |
| `04-functions-triggers.sql` | Function existence, return types, SECURITY DEFINER, STABLE volatility, trigger wiring, no-auth smoke tests | ~38 |
| **Total** | | **~483 assertions** |

---

## Infrastructure Requirements

| Requirement | Min version | Notes |
|-------------|-------------|-------|
| PostgreSQL | 15+ | Must have `pgcrypto` and `pgtap` extensions available |
| pgTAP extension | 1.2+ | `CREATE EXTENSION pgtap` in the test DB |
| `pg_prove` CLI | any | Ships with the pgTAP Perl distribution |
| Supabase CLI | 1.x | Only needed for **Option A** below |
| Docker | 24+ | Only needed for **Option B** below |

---

## Option A — Supabase CLI local stack (recommended for development)

This is the fastest path if you have the Supabase CLI installed.

```bash
# 1. Install Supabase CLI (if not already)
brew install supabase/tap/supabase        # macOS
# or: https://supabase.com/docs/guides/cli/getting-started

# 2. Start the local stack (first run pulls Docker images)
supabase start

# 3. Apply schema + migrations via reset
supabase db reset

# 4. Install pg_prove (pgTAP Perl client)
cpan TAP::Parser::SourceHandler::pgTAP
# or on macOS: brew install pgtap

# 5. Run all tests
bash supabase/tests/run.sh --mode supabase
```

`supabase db reset` applies `supabase/schema.sql` and all migration files in the order configured in `supabase/config.toml`. If you manage migrations manually (no config.toml), apply them in this order before running tests:

```bash
DB_URL=$(supabase status --output env | grep DB_URL | cut -d= -f2)
psql "$DB_URL" -f supabase/schema.sql
psql "$DB_URL" -f supabase/migration-mvp.sql
psql "$DB_URL" -f supabase/migration-c2-c3-pin-bank.sql
psql "$DB_URL" -f supabase/migration-payment-methods-v1.sql
psql "$DB_URL" -f supabase/migration-profile-fields.sql
```

Then run:

```bash
DB_URL=$(supabase status --output env | grep DB_URL | cut -d= -f2)
pg_prove --verbose --recursive --ext .sql --dbname "$DB_URL" supabase/tests/0*.sql
```

---

## Option B — Docker Postgres (CI / no Supabase CLI)

The runner script automates this fully:

```bash
bash supabase/tests/run.sh --mode docker
```

This:
1. Pulls `postgres:15`
2. Starts a throwaway container on port 54322
3. Stubs the `auth` schema (required by schema.sql which references `auth.users`)
4. Applies schema + all migrations
5. Runs tests via `pg_prove` (or `psql` if `pg_prove` is not installed locally)
6. Removes the container

> **Note on pgTAP in Docker:** `postgres:15` does not ship pgTAP. The script attempts `apt-get install postgresql-15-pgtap`. For a guaranteed environment, use `supabase/postgres:15` which bundles pgTAP. Change the image name in `run.sh` at the `docker pull` line.

---

## Option C — GitHub Actions CI

Add this job to your workflow:

```yaml
name: Database Tests

on: [push, pull_request]

jobs:
  pgtap:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: supabase/postgres:15.8.1.060
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: arisan_test
        ports:
          - 54322:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Install pg_prove
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y -qq libtap-parser-sourcehandler-pgtap-perl

      - name: Create auth schema stub
        run: |
          psql "postgresql://postgres:postgres@localhost:54322/arisan_test" <<'SQL'
          CREATE SCHEMA IF NOT EXISTS auth;
          CREATE TABLE IF NOT EXISTS auth.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            raw_user_meta_data JSONB
          );
          CREATE OR REPLACE FUNCTION auth.uid()
          RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT NULL::UUID; $$;
          SQL

      - name: Apply schema
        run: psql "postgresql://postgres:postgres@localhost:54322/arisan_test" -f supabase/schema.sql

      - name: Apply migrations
        run: |
          psql "postgresql://postgres:postgres@localhost:54322/arisan_test" -f supabase/migration-mvp.sql
          psql "postgresql://postgres:postgres@localhost:54322/arisan_test" -f supabase/migration-c2-c3-pin-bank.sql
          psql "postgresql://postgres:postgres@localhost:54322/arisan_test" -f supabase/migration-payment-methods-v1.sql
          psql "postgresql://postgres:postgres@localhost:54322/arisan_test" -f supabase/migration-profile-fields.sql

      - name: Install pgTAP
        run: |
          psql "postgresql://postgres:postgres@localhost:54322/arisan_test" \
            -c "CREATE EXTENSION IF NOT EXISTS pgtap;"

      - name: Run pgTAP tests
        run: |
          pg_prove \
            --verbose \
            --recursive \
            --ext .sql \
            --host localhost \
            --port 54322 \
            --dbname arisan_test \
            --username postgres \
            supabase/tests/0*.sql
        env:
          PGPASSWORD: postgres
```

---

## Coverage details

### Tables covered
`users`, `groups`, `group_members`, `rounds`, `payments`, `notifications`, `bills`, `bill_participants`, `bill_splits`, `bill_settlements`, `invite_links`, `user_contacts`, `bank_accounts`, `bill_comments`, `recurring_bills`, `debt_simplifications`, `plans`, `user_subscriptions`, `group_subscriptions`, `payment_transactions`, `usage_tracking` — **21 tables total**.

### Migration columns included
All columns added by the four migration files are tested:
- `migration-mvp.sql`: `group_members.member_name`, `rounds.recipient_name`, `payments.payer_name`, `bill_participants.participant_name`, `bill_splits.participant_name/is_settled/settled_at`
- `migration-c2-c3-pin-bank.sql`: `users.pin_hash`, `users.app_lock_enabled`, full `bank_accounts` table
- `migration-profile-fields.sql`: `users.gender`, `users.payment_methods`
- `migration-payment-methods-v1.sql`: `users_select_own_or_peer` policy replacement, `is_group_co_member` function

### What is NOT tested here
- **Data-level RLS enforcement**: confirming that user A cannot read user B's rows requires a live auth session. These are integration tests best run via Supabase's built-in `supabase test db` framework against a seeded dataset.
- **Storage bucket policies**: `migration-storage-buckets.sql` creates policies on `storage.objects`. The storage schema is not stubbed in the Docker mode; add stub tables if you extend the suite.
- **Performance / index usage**: `EXPLAIN ANALYZE` tests are not included. Use `pgbench` or dedicated load tests for that.

---

## Execution status

**These test files were authored but NOT executed** in the environment where they were written. `psql`, `pg_prove`, `supabase`, and `docker` were all absent (`which` returned not-found for all four). The assertions are derived directly from the SQL source files and are correct to the best of code-reading analysis, but must be validated against a live database before being treated as a passing baseline.
