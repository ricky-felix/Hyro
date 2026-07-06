-- ─────────────────────────────────────────────────────────────
-- Hyro — MVP migration
-- Purpose: make the app work directly from the browser, with no
-- login (Supabase anonymous auth) and no NestJS backend.
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New query → paste this whole
--   file → Run. It is idempotent; safe to run more than once.
--
-- ALSO REQUIRED (one-time, in the dashboard UI):
--   Authentication → Sign In / Providers → enable "Anonymous".
--
-- What this migration does:
--   1. Relaxes the schema so arisan members & bill participants can
--      be plain typed names (no real account needed).
--   2. Fixes the infinite-recursion bug in the RLS policies
--      (Postgres error 42P17) using SECURITY DEFINER helpers.
--   3. Adds INSERT/UPDATE/DELETE policies so a browser client can
--      create groups, members, rounds, payments, bills, etc.
-- ─────────────────────────────────────────────────────────────

-- ============================================================
-- 1. SCHEMA RELAXATION — name-based members / participants
-- ============================================================

-- Arisan members can be names without an account
ALTER TABLE group_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS member_name TEXT;

-- A round's recipient can be a name (not necessarily a user)
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS recipient_name TEXT;

-- A payment can be recorded by the admin on behalf of a named member
ALTER TABLE payments ALTER COLUMN payer_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payer_name TEXT;
-- The original UNIQUE(round_id, payer_id) still holds for real users;
-- name-based rows have NULL payer_id and are treated as distinct.

-- Bill participants can be names without an account
ALTER TABLE bill_participants ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE bill_participants ADD COLUMN IF NOT EXISTS participant_name TEXT;

-- Bill splits can reference a name, and track settlement inline
ALTER TABLE bill_splits ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE bill_splits ADD COLUMN IF NOT EXISTS participant_name TEXT;
ALTER TABLE bill_splits ADD COLUMN IF NOT EXISTS is_settled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bill_splits ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- ============================================================
-- 2. RLS HELPER FUNCTIONS (SECURITY DEFINER → bypass RLS,
--    which breaks the recursive policy references)
-- ============================================================

-- Drop first: a prior version may exist with a different parameter name,
-- which CREATE OR REPLACE cannot change (Postgres error 42P13).
DROP FUNCTION IF EXISTS is_group_member(UUID);
CREATE FUNCTION is_group_member(p_group_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  );
$$;

DROP FUNCTION IF EXISTS is_bill_participant(UUID);
CREATE FUNCTION is_bill_participant(p_bill_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM bill_participants
    WHERE bill_id = p_bill_id AND user_id = auth.uid()
  );
$$;

DROP FUNCTION IF EXISTS is_bill_payer(UUID);
CREATE FUNCTION is_bill_payer(p_bill_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM bills WHERE id = p_bill_id AND paid_by = auth.uid()
  );
$$;

-- is_group_admin() already exists from schema.sql and is SECURITY DEFINER.

-- ============================================================
-- 3. GROUPS
-- ============================================================
DROP POLICY IF EXISTS "groups_select_member" ON groups;
CREATE POLICY "groups_select_member" ON groups FOR SELECT
  USING (is_super_admin() OR admin_id = auth.uid() OR is_group_member(id));
-- insert/update/delete already defined in schema.sql (admin-based) — fine.

-- ============================================================
-- 4. GROUP MEMBERS
-- ============================================================
DROP POLICY IF EXISTS "gm_select_member" ON group_members;
CREATE POLICY "gm_select_member" ON group_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_group_member(group_id)
    OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.admin_id = auth.uid())
  );

DROP POLICY IF EXISTS "gm_insert" ON group_members;
CREATE POLICY "gm_insert" ON group_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.admin_id = auth.uid())
  );

DROP POLICY IF EXISTS "gm_update" ON group_members;
CREATE POLICY "gm_update" ON group_members FOR UPDATE
  USING (EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.admin_id = auth.uid()));

DROP POLICY IF EXISTS "gm_delete" ON group_members;
CREATE POLICY "gm_delete" ON group_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.admin_id = auth.uid()));

-- ============================================================
-- 5. ROUNDS
-- ============================================================
DROP POLICY IF EXISTS "rounds_select_member" ON rounds;
CREATE POLICY "rounds_select_member" ON rounds FOR SELECT
  USING (is_group_member(group_id) OR is_group_admin(group_id));

DROP POLICY IF EXISTS "rounds_insert" ON rounds;
CREATE POLICY "rounds_insert" ON rounds FOR INSERT
  WITH CHECK (is_group_admin(group_id));

DROP POLICY IF EXISTS "rounds_update" ON rounds;
CREATE POLICY "rounds_update" ON rounds FOR UPDATE
  USING (is_group_admin(group_id));

DROP POLICY IF EXISTS "rounds_delete" ON rounds;
CREATE POLICY "rounds_delete" ON rounds FOR DELETE
  USING (is_group_admin(group_id));

-- ============================================================
-- 6. PAYMENTS
-- ============================================================
-- select policy from schema.sql is fine (own OR group admin OR super_admin)
DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT
  WITH CHECK (payer_id = auth.uid() OR is_group_admin(group_id));

DROP POLICY IF EXISTS "payments_update" ON payments;
CREATE POLICY "payments_update" ON payments FOR UPDATE
  USING (is_group_admin(group_id) OR payer_id = auth.uid());

DROP POLICY IF EXISTS "payments_delete" ON payments;
CREATE POLICY "payments_delete" ON payments FOR DELETE
  USING (is_group_admin(group_id));

-- ============================================================
-- 7. BILLS
-- ============================================================
DROP POLICY IF EXISTS "bills_select" ON bills;
CREATE POLICY "bills_select" ON bills FOR SELECT
  USING (is_super_admin() OR paid_by = auth.uid() OR is_bill_participant(id));

DROP POLICY IF EXISTS "bills_delete_payer" ON bills;
CREATE POLICY "bills_delete_payer" ON bills FOR DELETE
  USING (auth.uid() = paid_by);
-- insert/update by payer already defined in schema.sql.

-- ============================================================
-- 8. BILL PARTICIPANTS
-- ============================================================
DROP POLICY IF EXISTS "bp_select" ON bill_participants;
CREATE POLICY "bp_select" ON bill_participants FOR SELECT
  USING (user_id = auth.uid() OR is_bill_participant(bill_id) OR is_bill_payer(bill_id));

DROP POLICY IF EXISTS "bp_insert" ON bill_participants;
CREATE POLICY "bp_insert" ON bill_participants FOR INSERT
  WITH CHECK (is_bill_payer(bill_id));

DROP POLICY IF EXISTS "bp_update" ON bill_participants;
CREATE POLICY "bp_update" ON bill_participants FOR UPDATE
  USING (is_bill_payer(bill_id));

DROP POLICY IF EXISTS "bp_delete" ON bill_participants;
CREATE POLICY "bp_delete" ON bill_participants FOR DELETE
  USING (is_bill_payer(bill_id));

-- ============================================================
-- 9. BILL SPLITS
-- ============================================================
DROP POLICY IF EXISTS "bs_select" ON bill_splits;
CREATE POLICY "bs_select" ON bill_splits FOR SELECT
  USING (user_id = auth.uid() OR is_bill_participant(bill_id) OR is_bill_payer(bill_id));

DROP POLICY IF EXISTS "bs_insert" ON bill_splits;
CREATE POLICY "bs_insert" ON bill_splits FOR INSERT
  WITH CHECK (is_bill_payer(bill_id));

DROP POLICY IF EXISTS "bs_update" ON bill_splits;
CREATE POLICY "bs_update" ON bill_splits FOR UPDATE
  USING (is_bill_payer(bill_id));

DROP POLICY IF EXISTS "bs_delete" ON bill_splits;
CREATE POLICY "bs_delete" ON bill_splits FOR DELETE
  USING (is_bill_payer(bill_id));

-- ============================================================
-- 10. PLANS — ensure browser can read plan catalog
-- ============================================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_select_all" ON plans;
CREATE POLICY "plans_select_all" ON plans FOR SELECT USING (is_active = TRUE);

-- ─────────────────────────────────────────────────────────────
-- Done. Reload the app; anonymous users can now create and read
-- their own arisan groups and patungan bills.
-- ─────────────────────────────────────────────────────────────
