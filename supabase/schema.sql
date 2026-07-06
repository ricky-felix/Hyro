-- ─────────────────────────────────────────────────
-- Saku — Supabase Schema v3
-- Stack: NestJS (API) + React/Vite/Tailwind (UI) + Supabase PostgreSQL
--
-- Access pattern:
--   NestJS  → connects via SERVICE ROLE KEY (full access, RLS bypassed)
--   Browser → connects via ANON KEY only for Storage uploads
--   RLS     → acts as a secondary safety net, not primary auth layer
--   Auth    → NestJS issues JWTs using Supabase Auth, guards all routes
-- ─────────────────────────────────────────────────

-- 1. USERS
-- Extends Supabase auth.users with profile data
CREATE TABLE users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT UNIQUE,
  avatar_url   TEXT,
  language     TEXT NOT NULL DEFAULT 'id' CHECK (language IN ('id', 'en')),
  -- Platform-level role:
  --   'user'        → regular member (default)
  --   'super_admin' → platform owner, sees all groups/bills/analytics across all users
  platform_role TEXT NOT NULL DEFAULT 'user' CHECK (platform_role IN ('user', 'super_admin')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. GROUPS (Arisan)
CREATE TABLE groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  photo_url        TEXT,
  amount_per_round BIGINT NOT NULL,       -- stored in IDR, no decimals
  frequency        TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  giliran_method   TEXT NOT NULL CHECK (giliran_method IN ('random', 'manual')),
  start_date       DATE NOT NULL,
  total_rounds     INT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'completed', 'pending')),
  admin_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. GROUP MEMBERS
CREATE TABLE group_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  giliran_order INT,                      -- NULL until assigned
  -- Group-level role:
  --   'member' → regular participant (default)
  --   'admin'  → can confirm payments, manage members, edit group settings, view group analytics
  group_role    TEXT NOT NULL DEFAULT 'member' CHECK (group_role IN ('member', 'admin')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id),
  UNIQUE (group_id, giliran_order)
);

-- 4. ROUNDS
CREATE TABLE rounds (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  round_number   INT NOT NULL,
  recipient_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'upcoming'
                 CHECK (status IN ('upcoming', 'active', 'completed')),
  completed_at   TIMESTAMPTZ,
  UNIQUE (group_id, round_number)
);

-- 5. PAYMENTS (Arisan iuran)
CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  round_id         UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  payer_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount           BIGINT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'rejected')),
  proof_url        TEXT,
  notes            TEXT,
  rejection_reason TEXT,
  paid_at          TIMESTAMPTZ,
  confirmed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, payer_id)
);

-- 6. NOTIFICATIONS
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN (
               'payment_due', 'payment_confirmed', 'payment_rejected',
               'giliran_announced', 'member_joined', 'round_completed',
               'bill_created', 'bill_settled', 'bill_reminder',
               'settlement_confirmed', 'settlement_rejected'
             )),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  metadata   JSONB,                       -- e.g. { group_id, round_id, bill_id }
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- PATUNGAN MODULE (Bill Splitting)
-- ─────────────────────────────────────────────────

-- 7. BILLS
-- A shared expense created and fronted by one person
CREATE TABLE bills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,             -- e.g. "Makan malam Restoran Padang"
  description  TEXT,
  category     TEXT CHECK (category IN (
                 'food', 'transport', 'accommodation',
                 'utilities', 'entertainment', 'shopping', 'other'
               )),
  total_amount BIGINT NOT NULL,           -- total in IDR
  currency     TEXT NOT NULL DEFAULT 'IDR',
  paid_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  split_method TEXT NOT NULL DEFAULT 'equal' CHECK (split_method IN (
                 'equal',       -- divide equally among all
                 'exact',       -- each person pays a fixed amount
                 'percentage',  -- each pays a % of total
                 'shares'       -- divide by number of shares
               )),
  receipt_url  TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
  group_id     UUID REFERENCES groups(id) ON DELETE SET NULL,  -- optional arisan group link
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at   TIMESTAMPTZ
);

-- 8. BILL PARTICIPANTS
-- Everyone involved in splitting this bill
CREATE TABLE bill_participants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id    UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shares     INT NOT NULL DEFAULT 1,      -- for 'shares' method
  percentage NUMERIC(5,2),               -- for 'percentage' method
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bill_id, user_id)
);

-- 9. BILL SPLITS
-- Computed amount each participant owes
CREATE TABLE bill_splits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id        UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES bill_participants(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_owed    BIGINT NOT NULL,          -- in IDR
  is_payer       BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = person who fronted the money
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bill_id, user_id)
);

-- 10. BILL SETTLEMENTS
-- Individual repayments from a participant back to the bill payer
CREATE TABLE bill_settlements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id      UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  payer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,    -- paying back
  receiver_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,    -- receiving money
  amount       BIGINT NOT NULL,
  proof_url    TEXT,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'confirmed', 'rejected')),
  settled_at   TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────

CREATE INDEX ON group_members (group_id);
CREATE INDEX ON group_members (user_id);
CREATE INDEX ON rounds (group_id);
CREATE INDEX ON payments (group_id);
CREATE INDEX ON payments (payer_id);
CREATE INDEX ON payments (status);
CREATE INDEX ON notifications (user_id, is_read);
CREATE INDEX ON bills (paid_by);
CREATE INDEX ON bills (status);
CREATE INDEX ON bills (group_id);
CREATE INDEX ON bill_participants (bill_id);
CREATE INDEX ON bill_participants (user_id);
CREATE INDEX ON bill_splits (bill_id);
CREATE INDEX ON bill_splits (user_id);
CREATE INDEX ON bill_settlements (bill_id);
CREATE INDEX ON bill_settlements (payer_id);
CREATE INDEX ON bill_settlements (receiver_id);
CREATE INDEX ON bill_settlements (status);

-- ─────────────────────────────────────────────────
-- ROLE HELPER FUNCTION
-- ─────────────────────────────────────────────────

-- Returns TRUE if the calling user has platform_role = 'super_admin'
-- Used in RLS policies to grant platform-wide read access for analytics
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND platform_role = 'super_admin'
  );
$$;

-- Returns TRUE if the calling user is admin of a specific group
-- (either via groups.admin_id or group_members.group_role = 'admin')
CREATE OR REPLACE FUNCTION is_group_admin(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id
      AND user_id = auth.uid()
      AND group_role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM groups
    WHERE id = p_group_id AND admin_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────
-- AUTH TRIGGER — auto-create a profile row on sign-up
-- ─────────────────────────────────────────────────

-- Creates a public.users row whenever an auth.users row is inserted.
-- Anonymous-safe: an anonymous sign-in carries no `full_name` metadata,
-- so without the COALESCE fallback the NOT NULL `name` constraint would
-- fail and roll back the entire auth.users INSERT — surfacing as
-- "Database error creating anonymous user" from GoTrue.
-- SECURITY DEFINER so it bypasses RLS; explicit search_path for safety.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, phone)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'Tamu'),
    NULLIF(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_settlements ENABLE ROW LEVEL SECURITY;

-- USERS
CREATE POLICY "users_select_own"  ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_insert_own"  ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own"  ON users FOR UPDATE USING (auth.uid() = id);

-- GROUPS: members can read, only admin can write, super_admin can read all
CREATE POLICY "groups_select_member" ON groups FOR SELECT
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM group_members WHERE group_id = groups.id AND user_id = auth.uid())
  );
CREATE POLICY "groups_insert_auth"   ON groups FOR INSERT WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "groups_update_admin"  ON groups FOR UPDATE USING (is_group_admin(id));
CREATE POLICY "groups_delete_admin"  ON groups FOR DELETE USING (auth.uid() = admin_id);

-- GROUP MEMBERS: visible to fellow group members
CREATE POLICY "gm_select_member" ON group_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM group_members gm2
    WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid()
  ));

-- ROUNDS: visible to group members
CREATE POLICY "rounds_select_member" ON rounds FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM group_members WHERE group_id = rounds.group_id AND user_id = auth.uid()
  ));

-- PAYMENTS: own payments OR group admin OR super_admin
CREATE POLICY "payments_select" ON payments FOR SELECT
  USING (
    is_super_admin() OR
    payer_id = auth.uid() OR
    is_group_admin(group_id)
  );
CREATE POLICY "payments_insert" ON payments FOR INSERT WITH CHECK (auth.uid() = payer_id);

-- NOTIFICATIONS: own only
CREATE POLICY "notifs_select_own" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifs_update_own" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- BILLS: creator or participants can read, super_admin can read all
CREATE POLICY "bills_select" ON bills FOR SELECT
  USING (
    is_super_admin() OR
    paid_by = auth.uid() OR
    EXISTS (SELECT 1 FROM bill_participants WHERE bill_id = bills.id AND user_id = auth.uid())
  );
CREATE POLICY "bills_insert_auth"  ON bills FOR INSERT WITH CHECK (auth.uid() = paid_by);
CREATE POLICY "bills_update_payer" ON bills FOR UPDATE USING (auth.uid() = paid_by);

-- BILL PARTICIPANTS: visible to all participants of that bill
CREATE POLICY "bp_select" ON bill_participants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM bill_participants bp2
    WHERE bp2.bill_id = bill_participants.bill_id AND bp2.user_id = auth.uid()
  ));

-- BILL SPLITS: visible to all participants of that bill
CREATE POLICY "bs_select" ON bill_splits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM bill_participants WHERE bill_id = bill_splits.bill_id AND user_id = auth.uid()
  ));

-- BILL SETTLEMENTS: payer or receiver can read; payer can insert
CREATE POLICY "bsettl_select"          ON bill_settlements FOR SELECT
  USING (payer_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "bsettl_insert"          ON bill_settlements FOR INSERT WITH CHECK (auth.uid() = payer_id);
CREATE POLICY "bsettl_update_receiver" ON bill_settlements FOR UPDATE USING (auth.uid() = receiver_id);

-- ─────────────────────────────────────────────────
-- NEW TABLES — v3 additions
-- ─────────────────────────────────────────────────

-- 11. INVITE_LINKS
-- Tokenized shareable URLs for joining an arisan group
CREATE TABLE invite_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  max_uses    INT,                          -- NULL = unlimited
  use_count   INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,                  -- NULL = never expires
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON invite_links (token);
CREATE INDEX ON invite_links (group_id);

ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

-- Only group admin can create/manage invite links
CREATE POLICY "invite_select_admin" ON invite_links FOR SELECT
  USING (EXISTS (SELECT 1 FROM groups WHERE id = invite_links.group_id AND admin_id = auth.uid()));
CREATE POLICY "invite_insert_admin" ON invite_links FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM groups WHERE id = invite_links.group_id AND admin_id = auth.uid()));
CREATE POLICY "invite_update_admin" ON invite_links FOR UPDATE
  USING (EXISTS (SELECT 1 FROM groups WHERE id = invite_links.group_id AND admin_id = auth.uid()));
-- Public read by token is handled via a Supabase Edge Function (bypass RLS)

-- 12. USER_CONTACTS
-- Saved frequent collaborators to avoid retyping phone numbers
CREATE TABLE user_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id   UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL if not yet on platform
  name         TEXT NOT NULL,                -- display name (can differ from profile name)
  phone        TEXT,
  last_used_at TIMESTAMPTZ,
  use_count    INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, phone)
);

CREATE INDEX ON user_contacts (owner_id);
CREATE INDEX ON user_contacts (owner_id, last_used_at DESC);

ALTER TABLE user_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select_own" ON user_contacts FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "contacts_insert_own" ON user_contacts FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "contacts_update_own" ON user_contacts FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "contacts_delete_own" ON user_contacts FOR DELETE USING (owner_id = auth.uid());

-- 13. BILL_COMMENTS
-- Threaded comment per bill for clarifications and context
CREATE TABLE bill_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  parent_id   UUID REFERENCES bill_comments(id) ON DELETE CASCADE,  -- NULL = top-level
  deleted_at  TIMESTAMPTZ,                  -- soft delete
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON bill_comments (bill_id, created_at);
CREATE INDEX ON bill_comments (parent_id);

ALTER TABLE bill_comments ENABLE ROW LEVEL SECURITY;

-- Visible to bill participants only
CREATE POLICY "comments_select" ON bill_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM bill_participants WHERE bill_id = bill_comments.bill_id AND user_id = auth.uid()
  ));
CREATE POLICY "comments_insert" ON bill_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM bill_participants WHERE bill_id = bill_comments.bill_id AND user_id = auth.uid())
  );
-- Own comments only: edit or soft-delete
CREATE POLICY "comments_update_own" ON bill_comments FOR UPDATE USING (auth.uid() = user_id);

-- 14. RECURRING_BILLS
-- Template for bills that repeat on a schedule (rent, utilities, subscriptions)
CREATE TABLE recurring_bills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT CHECK (category IN (
                    'food', 'transport', 'accommodation', 'utilities',
                    'entertainment', 'shopping', 'other'
                  )),
  total_amount    BIGINT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'IDR',
  paid_by         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  split_method    TEXT NOT NULL DEFAULT 'equal' CHECK (split_method IN (
                    'equal', 'exact', 'percentage', 'shares'
                  )),
  frequency       TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  start_date      DATE NOT NULL,
  end_date        DATE,                     -- NULL = runs indefinitely
  next_due_date   DATE NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Stores participant config as JSONB for fast template cloning
  participants    JSONB NOT NULL DEFAULT '[]',
  group_id        UUID REFERENCES groups(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each time a recurring_bill fires, it creates a real bill row and links back here
ALTER TABLE bills ADD COLUMN IF NOT EXISTS recurring_bill_id UUID REFERENCES recurring_bills(id) ON DELETE SET NULL;

CREATE INDEX ON recurring_bills (paid_by);
CREATE INDEX ON recurring_bills (next_due_date) WHERE is_active = TRUE;

ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_select" ON recurring_bills FOR SELECT
  USING (paid_by = auth.uid() OR participants @> jsonb_build_array(auth.uid()::text));
CREATE POLICY "recurring_insert" ON recurring_bills FOR INSERT WITH CHECK (auth.uid() = paid_by);
CREATE POLICY "recurring_update" ON recurring_bills FOR UPDATE USING (auth.uid() = paid_by);
CREATE POLICY "recurring_delete" ON recurring_bills FOR DELETE USING (auth.uid() = paid_by);

-- 15. DEBT_SIMPLIFICATIONS
-- Computed simplified payment routes (A→B→C becomes A→C)
-- Generated by a backend function/edge function, stored for display
CREATE TABLE debt_simplifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id      UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- who should pay
  to_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- who should receive
  amount       BIGINT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'dismissed')),
  -- Original debt chain for transparency (e.g. ["user_a owes user_b Rp50k", "user_b owes user_c Rp50k"])
  chain        JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at   TIMESTAMPTZ
);

CREATE INDEX ON debt_simplifications (bill_id);
CREATE INDEX ON debt_simplifications (from_user_id);
CREATE INDEX ON debt_simplifications (to_user_id);

ALTER TABLE debt_simplifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debt_select" ON debt_simplifications FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY "debt_update_from" ON debt_simplifications FOR UPDATE
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- ─────────────────────────────────────────────────
-- MONETIZATION TABLES
-- Plans: free | boss | business
-- Models: user subscription + per-group subscription + transaction fees
-- ─────────────────────────────────────────────────

-- 16. PLANS
-- Source of truth for plan limits — stored in DB so NestJS can query without redeploy
CREATE TABLE plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT NOT NULL UNIQUE,   -- 'free' | 'boss' | 'business'
  name                  TEXT NOT NULL,           -- "Gratis" | "Boss" | "Bisnis"
  description           TEXT,
  price_monthly         BIGINT NOT NULL DEFAULT 0,  -- IDR, 0 = free
  price_yearly          BIGINT NOT NULL DEFAULT 0,  -- IDR, discounted annual
  -- Arisan limits
  max_groups            INT,                    -- NULL = unlimited
  max_members_per_group INT,                    -- NULL = unlimited
  -- Patungan limits
  max_bills_per_month   INT,                    -- NULL = unlimited
  -- Feature flags
  recurring_bills       BOOLEAN NOT NULL DEFAULT FALSE,
  analytics_access      BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_export            BOOLEAN NOT NULL DEFAULT FALSE,
  debt_simplification   BOOLEAN NOT NULL DEFAULT FALSE,
  custom_invite_links   BOOLEAN NOT NULL DEFAULT FALSE,
  priority_support      BOOLEAN NOT NULL DEFAULT FALSE,
  white_label           BOOLEAN NOT NULL DEFAULT FALSE,  -- business only
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default plans
INSERT INTO plans (slug, name, description, price_monthly, price_yearly,
  max_groups, max_members_per_group, max_bills_per_month,
  recurring_bills, analytics_access, pdf_export, debt_simplification,
  custom_invite_links, priority_support, white_label) VALUES
('free', 'Gratis', 'Cocok untuk grup kecil', 0, 0,
  2, 10, 5,
  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('boss', 'Boss', 'Untuk pengelola arisan aktif', 29000, 290000,
  NULL, NULL, NULL,
  TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE),
('business', 'Bisnis', 'Untuk koperasi dan organisasi', 199000, 1990000,
  NULL, NULL, NULL,
  TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE);

-- 17. USER_SUBSCRIPTIONS
-- Tracks the current active plan for a user (boss / business)
CREATE TABLE user_subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id        UUID NOT NULL REFERENCES plans(id),
  billing_cycle  TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  -- Payment gateway reference (Xendit or Midtrans invoice ID)
  payment_ref    TEXT,
  gateway        TEXT CHECK (gateway IN ('xendit', 'midtrans', 'manual')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ NOT NULL,
  cancelled_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)   -- one active subscription per user
);

CREATE INDEX ON user_subscriptions (user_id);
CREATE INDEX ON user_subscriptions (status);
CREATE INDEX ON user_subscriptions (current_period_end) WHERE status = 'active';

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_select_own"  ON user_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "sub_select_sadmin" ON user_subscriptions FOR SELECT USING (is_super_admin());

-- 18. GROUP_SUBSCRIPTIONS
-- Optional: per-group billing where the group admin pays for that specific group
-- Used for Option 2 (admin pays per group, members always free)
CREATE TABLE group_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,  -- always the group admin
  plan_id       UUID NOT NULL REFERENCES plans(id),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  payment_ref   TEXT,
  gateway       TEXT CHECK (gateway IN ('xendit', 'midtrans', 'manual')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancelled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id)
);

CREATE INDEX ON group_subscriptions (group_id);
CREATE INDEX ON group_subscriptions (paid_by);
CREATE INDEX ON group_subscriptions (status);
CREATE INDEX ON group_subscriptions (current_period_end) WHERE status = 'active';

ALTER TABLE group_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gsub_select_admin" ON group_subscriptions FOR SELECT
  USING (paid_by = auth.uid() OR is_super_admin());

-- 19. PAYMENT_TRANSACTIONS
-- Ledger of all payment gateway transactions (subscriptions + in-app payments)
-- This is your audit trail — never delete rows, only update status
CREATE TABLE payment_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type            TEXT NOT NULL CHECK (type IN (
                    'subscription_new',      -- first payment for a plan
                    'subscription_renewal',  -- recurring charge
                    'subscription_upgrade',  -- plan change
                    'in_app_payment'         -- future: in-app iuran via gateway
                  )),
  -- What this transaction is for
  subscription_id       UUID REFERENCES user_subscriptions(id),
  group_subscription_id UUID REFERENCES group_subscriptions(id),
  -- Gateway details
  gateway         TEXT NOT NULL CHECK (gateway IN ('xendit', 'midtrans', 'manual')),
  gateway_tx_id   TEXT,                   -- external reference ID from gateway
  gateway_status  TEXT,                   -- raw status string from gateway webhook
  -- Amount
  amount          BIGINT NOT NULL,         -- IDR
  currency        TEXT NOT NULL DEFAULT 'IDR',
  -- Internal status
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'expired')),
  -- Webhook payload stored for debugging
  gateway_payload JSONB,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON payment_transactions (user_id);
CREATE INDEX ON payment_transactions (gateway_tx_id);
CREATE INDEX ON payment_transactions (status);
CREATE INDEX ON payment_transactions (created_at DESC);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_select_own"    ON payment_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "tx_select_sadmin" ON payment_transactions FOR SELECT USING (is_super_admin());

-- 20. USAGE_TRACKING
-- Tracks monthly usage per user for enforcing free tier limits in NestJS
-- NestJS checks this before allowing group/bill creation
CREATE TABLE usage_tracking (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month     DATE NOT NULL,          -- first day of month: e.g. '2025-06-01'
  groups_created   INT NOT NULL DEFAULT 0,
  bills_created    INT NOT NULL DEFAULT 0,
  -- Incremented by NestJS on each creation, reset monthly via cron
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_month)
);

CREATE INDEX ON usage_tracking (user_id, period_month);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_select_own"    ON usage_tracking FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "usage_select_sadmin" ON usage_tracking FOR SELECT USING (is_super_admin());

-- ─────────────────────────────────────────────────
-- PLAN LIMIT ENFORCEMENT (NestJS pattern reference)
-- ─────────────────────────────────────────────────

-- NestJS PlanGuard checks before group/bill creation:
--
-- 1. Get user's active plan:
--    SELECT p.* FROM plans p
--    JOIN user_subscriptions us ON us.plan_id = p.id
--    WHERE us.user_id = $userId AND us.status = 'active'
--    → If no active subscription, fall back to 'free' plan limits
--
-- 2. Check current usage:
--    SELECT * FROM usage_tracking
--    WHERE user_id = $userId AND period_month = date_trunc('month', NOW())
--
-- 3. Compare usage against plan limits:
--    if (plan.max_groups && usage.groups_created >= plan.max_groups) throw 403
--    if (plan.max_bills_per_month && usage.bills_created >= plan.max_bills_per_month) throw 403
--
-- 4. On success, increment usage:
--    INSERT INTO usage_tracking (...) VALUES (...)
--    ON CONFLICT (user_id, period_month)
--    DO UPDATE SET groups_created = usage_tracking.groups_created + 1

-- ─────────────────────────────────────────────────
-- MONETIZATION INDEXES
-- ─────────────────────────────────────────────────

CREATE INDEX ON plans (slug) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────
-- NESTJS MODULE STRUCTURE (reference)
-- Mirror these as NestJS modules in your src/ folder
-- ─────────────────────────────────────────────────

-- src/
-- ├── auth/               → JWT strategy, guards, Supabase Auth integration
-- │     AuthModule, AuthService, JwtStrategy, RolesGuard, Roles decorator
-- ├── users/              → user profile CRUD, platform_role management
-- ├── groups/             → arisan group CRUD, member management, giliran logic
-- ├── rounds/             → round generation, status transitions
-- ├── payments/           → iuran payment create/confirm/reject, proof URL handling
-- ├── bills/              → patungan bill CRUD, split calculation engine
-- │     split strategies: EqualSplit, ExactSplit, PercentageSplit, SharesSplit
-- ├── bill-participants/  → add/remove participants, contact auto-save trigger
-- ├── bill-settlements/   → settlement create/confirm/reject
-- ├── bill-comments/      → comment CRUD with soft delete
-- ├── recurring-bills/    → template management, cron job to auto-generate bills
-- ├── invite-links/       → token generation, join-via-token endpoint (public)
-- ├── contacts/           → user_contacts CRUD, recents query
-- ├── debt/               → debt simplification algorithm (graph reduction)
-- ├── notifications/      → create/read/mark-read, triggered by other services
-- ├── analytics/          → guarded by RolesGuard('admin','super_admin')
-- │     GroupAnalyticsService  → scoped to groups where user is admin
-- │     PlatformAnalyticsService → super_admin only
-- ├── storage/            → Supabase Storage signed URL generation for uploads
-- ├── plans/              → plan CRUD (super_admin only for write)
-- ├── subscriptions/      → user_subscriptions + group_subscriptions management
-- │     PlanGuard         → checks usage limits before group/bill creation
-- ├── billing/            → payment gateway integration (Xendit / Midtrans)
-- │     XenditWebhookController → receives payment confirmations
-- │     MidtransWebhookController
-- │     PaymentTransactionService → logs all gateway events
-- ├── usage/              → usage_tracking increments + monthly reset cron
-- └── common/             → pipes, interceptors, pagination, IDR formatting utils

-- KEY NESTJS PATTERNS FOR THIS PROJECT:
-- 1. RolesGuard checks req.user.platform_role and req.user.group_roles[]
-- 2. PlanGuard checks usage_tracking before allowing create operations
-- 3. All money stored as BIGINT (Rupiah, no decimals) — format to "Rp X.XXX" in frontend only
-- 4. Recurring bills: use @nestjs/schedule CronJob — runs nightly, checks next_due_date
-- 5. Usage reset: monthly cron on 1st of each month — resets bills_created, groups_created
-- 6. Debt simplification: implement as a graph problem (min-cost flow or greedy algorithm)
-- 7. File uploads: frontend uploads directly to Supabase Storage, sends back URL to NestJS endpoint
-- 8. Webhook security: validate Xendit/Midtrans webhook signature before processing payment_transactions
-- 9. Subscription expiry: nightly cron checks current_period_end, updates status to 'expired', downgrades user
