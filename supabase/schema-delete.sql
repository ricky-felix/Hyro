-- ─────────────────────────────────────────────────
-- Saku — Drop All Tables (v3)
-- 20 tables: Core + Patungan + v3 additions + Monetization
--
-- ⚠ WARNING: This permanently deletes ALL data.
-- Run in: Supabase Dashboard → SQL Editor
-- Order: child tables first, then parents (CASCADE handles deps)
-- ─────────────────────────────────────────────────

-- ── MONETIZATION (drop first — references users, groups, plans) ──
DROP TABLE IF EXISTS usage_tracking          CASCADE;
DROP TABLE IF EXISTS payment_transactions    CASCADE;
DROP TABLE IF EXISTS group_subscriptions     CASCADE;
DROP TABLE IF EXISTS user_subscriptions      CASCADE;
DROP TABLE IF EXISTS plans                   CASCADE;

-- ── v3 ADDITIONS ──
DROP TABLE IF EXISTS debt_simplifications    CASCADE;
DROP TABLE IF EXISTS recurring_bills         CASCADE;
DROP TABLE IF EXISTS bill_comments           CASCADE;
DROP TABLE IF EXISTS user_contacts           CASCADE;
DROP TABLE IF EXISTS invite_links            CASCADE;

-- ── PATUNGAN MODULE ──
DROP TABLE IF EXISTS bill_settlements        CASCADE;
DROP TABLE IF EXISTS bill_splits             CASCADE;
DROP TABLE IF EXISTS bill_participants       CASCADE;
DROP TABLE IF EXISTS bills                   CASCADE;

-- ── ARISAN CORE ──
DROP TABLE IF EXISTS notifications           CASCADE;
DROP TABLE IF EXISTS payments                CASCADE;
DROP TABLE IF EXISTS rounds                  CASCADE;
DROP TABLE IF EXISTS group_members           CASCADE;
DROP TABLE IF EXISTS groups                  CASCADE;
DROP TABLE IF EXISTS users                   CASCADE;

-- ── HELPER FUNCTIONS ──
DROP FUNCTION IF EXISTS is_super_admin()     CASCADE;
DROP FUNCTION IF EXISTS is_group_admin(UUID) CASCADE;

-- ── VERIFY ──
-- Should return 0 rows if everything dropped cleanly
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
