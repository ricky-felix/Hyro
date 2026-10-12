-- ─────────────────────────────────────────────────────────────
-- Hyro — Migration: Offline Sync
--
-- Adds `updated_at` (+ auto-update trigger) to the five tables the
-- offline-first client syncs: groups, group_members, rounds, payments,
-- notifications. The sync pull endpoint (GET /sync/pull?since=) uses
-- this column as the "what changed since my last sync" cursor.
--
-- Purely additive — no backfill risk, no data loss. Existing rows get
-- updated_at = NOW() at migration time (DEFAULT), which just means the
-- very first offline pull after this runs will be a full sync for
-- everyone (harmless, one-time).
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New query → paste this whole
--   file → Run. It is idempotent; safe to run more than once.
-- ─────────────────────────────────────────────────────────────

-- ============================================================
-- Shared trigger function — bump updated_at on every UPDATE.
-- (INSERT is covered by the column's own DEFAULT NOW().)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- groups
-- ============================================================

ALTER TABLE groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS groups_updated_at_idx ON groups (updated_at);

DROP TRIGGER IF EXISTS groups_set_updated_at ON groups;
CREATE TRIGGER groups_set_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- group_members
-- ============================================================

ALTER TABLE group_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS group_members_updated_at_idx ON group_members (updated_at);

DROP TRIGGER IF EXISTS group_members_set_updated_at ON group_members;
CREATE TRIGGER group_members_set_updated_at
  BEFORE UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- rounds
-- ============================================================

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS rounds_updated_at_idx ON rounds (updated_at);

DROP TRIGGER IF EXISTS rounds_set_updated_at ON rounds;
CREATE TRIGGER rounds_set_updated_at
  BEFORE UPDATE ON rounds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- payments
-- ============================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS payments_updated_at_idx ON payments (updated_at);

DROP TRIGGER IF EXISTS payments_set_updated_at ON payments;
CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- notifications
-- ============================================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS notifications_updated_at_idx ON notifications (updated_at);

DROP TRIGGER IF EXISTS notifications_set_updated_at ON notifications;
CREATE TRIGGER notifications_set_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Done.
-- ─────────────────────────────────────────────────────────────
