-- ─────────────────────────────────────────────────────────────
-- Hyro — Migration C2 & C3
-- Workstream C2: PIN security columns on users table
-- Workstream C3: bank_accounts table
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New query → paste this whole
--   file → Run. It is idempotent; safe to run more than once.
-- ─────────────────────────────────────────────────────────────

-- ============================================================
-- C2 — PIN SECURITY: add columns to users
-- ============================================================

-- pin_hash stores the bcrypt hash of the 6-digit PIN.
-- Never store or return the plaintext PIN.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- app_lock_enabled controls whether the app requires PIN on resume.
ALTER TABLE users ADD COLUMN IF NOT EXISTS app_lock_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- C3 — BANK ACCOUNTS: one row per user (unique on user_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank           TEXT NOT NULL,
  account_number TEXT NOT NULL,
  holder_name    TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- one account per user; upsert uses this conflict target
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS bank_accounts_user_id_idx ON bank_accounts (user_id);

-- ============================================================
-- RLS — bank_accounts
-- Pattern: own row only (mirrors users_select_own / users_update_own)
-- NestJS connects via SERVICE_ROLE_KEY (bypasses RLS), but we add
-- RLS as a secondary safety net consistent with the rest of the schema.
-- ============================================================

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ba_select_own" ON bank_accounts;
CREATE POLICY "ba_select_own" ON bank_accounts
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ba_insert_own" ON bank_accounts;
CREATE POLICY "ba_insert_own" ON bank_accounts
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ba_update_own" ON bank_accounts;
CREATE POLICY "ba_update_own" ON bank_accounts
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ba_delete_own" ON bank_accounts;
CREATE POLICY "ba_delete_own" ON bank_accounts
  FOR DELETE USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Done.
-- ─────────────────────────────────────────────────────────────
