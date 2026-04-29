-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 050: Add app tables to Supabase (官网数据库迁移)
-- Creates all missing application tables so the app can use Supabase as the
-- single database, gradually replacing the Neon DB.
-- All tables use IF NOT EXISTS so this is safe to re-run.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Profiles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT UNIQUE NOT NULL,
  ref_code        TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  referrer_id     UUID REFERENCES profiles(id),
  placement_id    UUID REFERENCES profiles(id),
  rank            TEXT,
  node_type       TEXT DEFAULT 'NONE',
  is_vip          BOOLEAN DEFAULT FALSE,
  vip_expires_at  TIMESTAMPTZ,
  vip_trial_used  BOOLEAN DEFAULT FALSE,
  total_deposited NUMERIC DEFAULT 0,
  total_withdrawn NUMERIC DEFAULT 0,
  referral_earnings NUMERIC DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS profiles_wallet_idx ON profiles(wallet_address);

-- ── Vault Positions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_positions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id),
  plan_type       TEXT NOT NULL,
  principal       NUMERIC NOT NULL,
  daily_rate      NUMERIC NOT NULL,
  start_date      TIMESTAMPTZ DEFAULT NOW(),
  end_date        TIMESTAMPTZ,
  status          TEXT DEFAULT 'ACTIVE',
  is_bonus        BOOLEAN DEFAULT FALSE,
  bonus_yield_locked BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vault_positions_user_idx ON vault_positions(user_id);

-- ── Vault Rewards ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_rewards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  position_id UUID NOT NULL REFERENCES vault_positions(id),
  reward_type TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  ar_price    NUMERIC,
  ar_amount   NUMERIC,
  ma_price    NUMERIC,
  ma_amount   NUMERIC,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vault_rewards_user_idx ON vault_rewards(user_id);

-- ── Transactions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id),
  type       TEXT NOT NULL,
  token      TEXT NOT NULL,
  amount     NUMERIC NOT NULL,
  tx_hash    TEXT,
  status     TEXT DEFAULT 'PENDING',
  details    JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_type_idx ON transactions(type);

-- ── Node Memberships ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS node_memberships (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id),
  node_type           TEXT NOT NULL,
  price               NUMERIC NOT NULL,
  status              TEXT DEFAULT 'PENDING_MILESTONES',
  start_date          TIMESTAMPTZ DEFAULT NOW(),
  end_date            TIMESTAMPTZ,
  payment_mode        TEXT DEFAULT 'FULL',
  deposit_amount      NUMERIC DEFAULT 0,
  milestone_stage     INTEGER DEFAULT 0,
  total_milestones    INTEGER DEFAULT 0,
  earnings_capacity   NUMERIC DEFAULT 0,
  contribution_amount NUMERIC DEFAULT 0,
  frozen_amount       NUMERIC DEFAULT 0,
  daily_rate          NUMERIC DEFAULT 0,
  locked_earnings     NUMERIC DEFAULT 0,
  released_earnings   NUMERIC DEFAULT 0,
  available_balance   NUMERIC DEFAULT 0,
  duration_days       INTEGER,
  tx_hash             TEXT,
  activated_rank      TEXT,
  earnings_paused     BOOLEAN DEFAULT FALSE,
  destroyed_earnings  NUMERIC DEFAULT 0,
  frozen_unlocked     BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS node_memberships_user_idx ON node_memberships(user_id);

-- ── Node Milestones ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS node_milestones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id    UUID REFERENCES node_memberships(id) ON DELETE CASCADE,
  milestone_index  INTEGER NOT NULL,
  required_rank    TEXT NOT NULL,
  deadline_days    INTEGER NOT NULL,
  deadline_at      TIMESTAMPTZ NOT NULL,
  achieved_at      TIMESTAMPTZ,
  status           TEXT DEFAULT 'PENDING',
  pass_action      TEXT DEFAULT 'CONTINUE',
  fail_action      TEXT DEFAULT 'PAUSE',
  earning_range    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Node Rewards ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS node_rewards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  reward_type TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS node_rewards_user_idx ON node_rewards(user_id);
CREATE INDEX IF NOT EXISTS node_rewards_type_idx ON node_rewards(reward_type);

-- ── Node Auth Codes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS node_auth_codes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT UNIQUE NOT NULL,
  node_type      TEXT NOT NULL DEFAULT 'MAX',
  status         TEXT NOT NULL DEFAULT 'ACTIVE',
  max_uses       INTEGER DEFAULT 1,
  used_count     INTEGER DEFAULT 0,
  used_by        TEXT,
  used_by_wallet TEXT,
  used_at        TIMESTAMPTZ,
  created_by     TEXT NOT NULL DEFAULT 'admin',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── System Config ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Revenue Events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source     TEXT NOT NULL,
  amount     NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Revenue Pools ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_pools (
  pool_name  TEXT PRIMARY KEY,
  balance    NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Earnings Releases ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS earnings_releases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id),
  source_type   TEXT NOT NULL,
  gross_amount  NUMERIC NOT NULL DEFAULT 0,
  burn_rate     NUMERIC NOT NULL DEFAULT 0,
  burn_amount   NUMERIC NOT NULL DEFAULT 0,
  net_amount    NUMERIC NOT NULL DEFAULT 0,
  release_days  INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'PENDING',
  release_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  release_end   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS earnings_releases_user_idx ON earnings_releases(user_id);

-- ── MA Swap Records ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ma_swap_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  ma_amount   NUMERIC NOT NULL,
  usdc_amount NUMERIC NOT NULL,
  ma_price    NUMERIC NOT NULL,
  tx_hash     TEXT,
  status      TEXT DEFAULT 'PENDING',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ma_swap_records_user_idx ON ma_swap_records(user_id);

-- ── Commission Records (team reward history) ──────────────────────────────────
-- Stores direct referral, differential, same-rank, override commission records
CREATE TABLE IF NOT EXISTS commission_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id),
  source_user_id UUID REFERENCES profiles(id),
  amount         NUMERIC NOT NULL,
  details        JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS commission_records_user_idx ON commission_records(user_id);

-- ── Hedge Positions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hedge_positions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id),
  amount          NUMERIC NOT NULL,
  purchase_amount NUMERIC DEFAULT 0,
  current_pnl     NUMERIC DEFAULT 0,
  status          TEXT DEFAULT 'ACTIVE',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Insurance Purchases ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_purchases (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id),
  amount     NUMERIC NOT NULL,
  status     TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RUNE Lock Positions (veRUNE) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rune_lock_positions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  usdt_amount NUMERIC,
  rune_amount NUMERIC NOT NULL,
  rune_price  NUMERIC,
  lock_days   INTEGER NOT NULL,
  ve_rune     NUMERIC NOT NULL,
  tx_hash     TEXT,
  start_date  TIMESTAMPTZ DEFAULT NOW(),
  end_date    TIMESTAMPTZ NOT NULL,
  status      TEXT DEFAULT 'ACTIVE',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── EMBER Burn Positions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ember_burn_positions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id),
  usdt_amount         NUMERIC,
  rune_amount         NUMERIC NOT NULL,
  rune_price          NUMERIC,
  daily_rate          NUMERIC NOT NULL,
  pending_ember       NUMERIC DEFAULT 0,
  total_claimed_ember NUMERIC DEFAULT 0,
  tx_hash             TEXT,
  last_claim_at       TIMESTAMPTZ DEFAULT NOW(),
  status              TEXT DEFAULT 'ACTIVE',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Vault Deposits (simple deposit log) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_deposits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  amount      NUMERIC NOT NULL,
  plan_type   TEXT,
  tx_hash     TEXT,
  status      TEXT DEFAULT 'CONFIRMED',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Seed default revenue pools ────────────────────────────────────────────────
INSERT INTO revenue_pools (pool_name, balance) VALUES
  ('node_pool', 0),
  ('buyback_pool', 0),
  ('insurance_pool', 0),
  ('treasury_pool', 0),
  ('operations', 0)
ON CONFLICT (pool_name) DO NOTHING;

-- ── Seed default system config ────────────────────────────────────────────────
INSERT INTO system_config (key, value) VALUES
  ('ma_price', '0.10'),
  ('direct_referral_rate', '0.05'),
  ('node_pool_share', '0.50')
ON CONFLICT (key) DO NOTHING;
