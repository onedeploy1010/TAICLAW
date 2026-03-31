-- =============================================
-- 005: Node Membership Overhaul
-- Multiple nodes, early bird deposits, milestones, earnings capacity
-- =============================================

-- ─────────────────────────────────────────────
-- A) Alter node_memberships table
-- ─────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'node_memberships' AND column_name = 'payment_mode'
  ) THEN
    ALTER TABLE node_memberships ADD COLUMN payment_mode TEXT DEFAULT 'FULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'node_memberships' AND column_name = 'deposit_amount'
  ) THEN
    ALTER TABLE node_memberships ADD COLUMN deposit_amount NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'node_memberships' AND column_name = 'milestone_stage'
  ) THEN
    ALTER TABLE node_memberships ADD COLUMN milestone_stage INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'node_memberships' AND column_name = 'total_milestones'
  ) THEN
    ALTER TABLE node_memberships ADD COLUMN total_milestones INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'node_memberships' AND column_name = 'earnings_capacity'
  ) THEN
    ALTER TABLE node_memberships ADD COLUMN earnings_capacity NUMERIC DEFAULT 1.0;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────
-- B) New node_milestones table
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS node_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES node_memberships(id) ON DELETE CASCADE,
  milestone_index INT NOT NULL,
  required_rank TEXT NOT NULL,
  deadline_days INT NOT NULL,
  deadline_at TIMESTAMPTZ NOT NULL,
  achieved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_milestones_membership ON node_milestones(membership_id);
CREATE INDEX IF NOT EXISTS idx_node_milestones_status ON node_milestones(status);

-- ─────────────────────────────────────────────
-- C) Milestone config in system_config
-- ─────────────────────────────────────────────

INSERT INTO system_config (key, value) VALUES
  ('MINI_MILESTONES', '[
    {"rank":"V1","days":10},
    {"rank":"V2","days":30},
    {"rank":"V3","days":60},
    {"rank":"V4","days":90}
  ]'),
  ('MAX_MILESTONES', '[
    {"rank":"V1","days":20},
    {"rank":"V2","days":40},
    {"rank":"V3","days":60},
    {"rank":"V4","days":80},
    {"rank":"V5","days":100},
    {"rank":"V6","days":120}
  ]'),
  ('EARLY_BIRD_DEPOSIT_RATE', '0.10')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ─────────────────────────────────────────────
-- D) Replace purchase_node RPC
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION purchase_node(
  addr TEXT,
  node_type_param TEXT,
  tx_hash TEXT DEFAULT NULL,
  payment_mode_param TEXT DEFAULT 'FULL'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  profile_row profiles%ROWTYPE;
  node_price NUMERIC;
  node_duration INT;
  node_rank TEXT;
  charge_amount NUMERIC;
  deposit_rate NUMERIC;
  membership node_memberships%ROWTYPE;
  milestones_json JSONB;
  milestone JSONB;
  m_index INT := 0;
  total_m INT;
  new_status TEXT;
  new_capacity NUMERIC;
  highest_node TEXT;
BEGIN
  SELECT * INTO profile_row FROM profiles WHERE wallet_address = addr;
  IF profile_row.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Determine node config
  IF node_type_param = 'MAX' THEN
    node_price := 6000;
    node_duration := 120;
    node_rank := 'V6';
  ELSE
    node_price := 1000;
    node_duration := 90;
    node_rank := 'V4';
  END IF;

  IF payment_mode_param = 'EARLY_BIRD' THEN
    -- Early bird: charge 10% deposit
    SELECT COALESCE(value::NUMERIC, 0.10) INTO deposit_rate
    FROM system_config WHERE key = 'EARLY_BIRD_DEPOSIT_RATE';

    charge_amount := node_price * deposit_rate;
    new_status := 'PENDING_MILESTONES';
    new_capacity := 0.0;

    -- Get milestones config
    IF node_type_param = 'MAX' THEN
      SELECT value::JSONB INTO milestones_json FROM system_config WHERE key = 'MAX_MILESTONES';
    ELSE
      SELECT value::JSONB INTO milestones_json FROM system_config WHERE key = 'MINI_MILESTONES';
    END IF;

    total_m := jsonb_array_length(milestones_json);

    -- Create membership
    INSERT INTO node_memberships (
      user_id, node_type, price, status, start_date, end_date,
      payment_mode, deposit_amount, milestone_stage, total_milestones, earnings_capacity
    )
    VALUES (
      profile_row.id, node_type_param, node_price, new_status, NOW(),
      NOW() + (node_duration || ' days')::INTERVAL,
      'EARLY_BIRD', charge_amount, 0, total_m, 0.0
    )
    RETURNING * INTO membership;

    -- Create milestone rows
    FOR milestone IN SELECT * FROM jsonb_array_elements(milestones_json)
    LOOP
      INSERT INTO node_milestones (membership_id, milestone_index, required_rank, deadline_days, deadline_at)
      VALUES (
        membership.id,
        m_index,
        milestone->>'rank',
        (milestone->>'days')::INT,
        NOW() + ((milestone->>'days')::INT || ' days')::INTERVAL
      );
      m_index := m_index + 1;
    END LOOP;

    -- Record deposit transaction
    INSERT INTO transactions (user_id, type, token, amount, tx_hash, status)
    VALUES (profile_row.id, 'NODE_DEPOSIT', 'USDC', charge_amount, tx_hash, 'CONFIRMED');

  ELSE
    -- Full payment
    charge_amount := node_price;
    new_status := 'ACTIVE';
    new_capacity := 1.0;

    IF node_type_param = 'MAX' THEN
      total_m := 6;
    ELSE
      total_m := 4;
    END IF;

    INSERT INTO node_memberships (
      user_id, node_type, price, status, start_date, end_date,
      payment_mode, deposit_amount, milestone_stage, total_milestones, earnings_capacity
    )
    VALUES (
      profile_row.id, node_type_param, node_price, new_status, NOW(),
      NOW() + (node_duration || ' days')::INTERVAL,
      'FULL', node_price, total_m, total_m, 1.0
    )
    RETURNING * INTO membership;

    -- Full payment gets rank immediately
    UPDATE profiles SET rank = node_rank WHERE id = profile_row.id;

    -- Record purchase transaction
    INSERT INTO transactions (user_id, type, token, amount, tx_hash, status)
    VALUES (profile_row.id, 'NODE_PURCHASE', 'USDC', charge_amount, tx_hash, 'CONFIRMED');
  END IF;

  -- Update profile.node_type to highest active node
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM node_memberships WHERE user_id = profile_row.id AND node_type = 'MAX' AND status IN ('ACTIVE', 'PENDING_MILESTONES'))
    THEN 'MAX'
    WHEN EXISTS (SELECT 1 FROM node_memberships WHERE user_id = profile_row.id AND node_type = 'MINI' AND status IN ('ACTIVE', 'PENDING_MILESTONES'))
    THEN 'MINI'
    ELSE 'NONE'
  END INTO highest_node;

  UPDATE profiles SET node_type = highest_node WHERE id = profile_row.id;

  RETURN to_jsonb(membership);
END;
$$;

-- ─────────────────────────────────────────────
-- E) check_node_milestones RPC
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_node_milestones(addr TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  profile_row profiles%ROWTYPE;
  ms RECORD;
  membership RECORD;
  rank_index INT;
  user_rank_index INT;
  required_rank_index INT;
  achieved_count INT := 0;
  failed_count INT := 0;
  capacity_increment NUMERIC;
BEGIN
  SELECT * INTO profile_row FROM profiles WHERE wallet_address = addr;
  IF profile_row.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  -- Process each pending milestone for this user's active early bird nodes
  FOR ms IN
    SELECT nm_ms.*, nm.user_id, nm.node_type, nm.total_milestones, nm.id AS mem_id
    FROM node_milestones nm_ms
    JOIN node_memberships nm ON nm.id = nm_ms.membership_id
    WHERE nm.user_id = profile_row.id
      AND nm.status = 'PENDING_MILESTONES'
      AND nm_ms.status = 'PENDING'
    ORDER BY nm_ms.milestone_index ASC
  LOOP
    -- Compare user rank to required rank (V1=1, V2=2, ..., V7=7)
    user_rank_index := CASE
      WHEN profile_row.rank = 'V1' THEN 1
      WHEN profile_row.rank = 'V2' THEN 2
      WHEN profile_row.rank = 'V3' THEN 3
      WHEN profile_row.rank = 'V4' THEN 4
      WHEN profile_row.rank = 'V5' THEN 5
      WHEN profile_row.rank = 'V6' THEN 6
      WHEN profile_row.rank = 'V7' THEN 7
      ELSE 0
    END;

    required_rank_index := CASE
      WHEN ms.required_rank = 'V1' THEN 1
      WHEN ms.required_rank = 'V2' THEN 2
      WHEN ms.required_rank = 'V3' THEN 3
      WHEN ms.required_rank = 'V4' THEN 4
      WHEN ms.required_rank = 'V5' THEN 5
      WHEN ms.required_rank = 'V6' THEN 6
      WHEN ms.required_rank = 'V7' THEN 7
      ELSE 0
    END;

    IF user_rank_index >= required_rank_index THEN
      -- Milestone achieved
      UPDATE node_milestones SET status = 'ACHIEVED', achieved_at = NOW()
      WHERE id = ms.id;

      capacity_increment := 1.0 / ms.total_milestones;

      UPDATE node_memberships
      SET milestone_stage = milestone_stage + 1,
          earnings_capacity = LEAST(earnings_capacity + capacity_increment, 1.0)
      WHERE id = ms.mem_id;

      achieved_count := achieved_count + 1;

    ELSIF NOW() > ms.deadline_at THEN
      -- Deadline passed: fail milestone, cancel node, forfeit deposit
      UPDATE node_milestones SET status = 'FAILED'
      WHERE id = ms.id;

      -- Fail all remaining milestones for this membership
      UPDATE node_milestones SET status = 'FAILED'
      WHERE membership_id = ms.mem_id AND status = 'PENDING';

      -- Cancel the membership
      UPDATE node_memberships SET status = 'CANCELLED'
      WHERE id = ms.mem_id;

      failed_count := failed_count + 1;
    END IF;
  END LOOP;

  -- Promote fully-achieved early bird nodes to ACTIVE
  UPDATE node_memberships
  SET status = 'ACTIVE'
  WHERE user_id = profile_row.id
    AND status = 'PENDING_MILESTONES'
    AND milestone_stage >= total_milestones;

  -- Update profile node_type to highest active node
  UPDATE profiles SET node_type = (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM node_memberships WHERE user_id = profile_row.id AND node_type = 'MAX' AND status = 'ACTIVE')
      THEN 'MAX'
      WHEN EXISTS (SELECT 1 FROM node_memberships WHERE user_id = profile_row.id AND node_type = 'MINI' AND status = 'ACTIVE')
      THEN 'MINI'
      ELSE 'NONE'
    END
  ) WHERE id = profile_row.id;

  -- Update rank for fully promoted nodes
  IF EXISTS (SELECT 1 FROM node_memberships WHERE user_id = profile_row.id AND node_type = 'MAX' AND status = 'ACTIVE' AND payment_mode = 'EARLY_BIRD' AND milestone_stage >= total_milestones) THEN
    UPDATE profiles SET rank = 'V6' WHERE id = profile_row.id AND rank < 'V6';
  ELSIF EXISTS (SELECT 1 FROM node_memberships WHERE user_id = profile_row.id AND node_type = 'MINI' AND status = 'ACTIVE' AND payment_mode = 'EARLY_BIRD' AND milestone_stage >= total_milestones) THEN
    UPDATE profiles SET rank = 'V4' WHERE id = profile_row.id AND rank < 'V4';
  END IF;

  RETURN jsonb_build_object('achieved', achieved_count, 'failed', failed_count);
END;
$$;

-- ─────────────────────────────────────────────
-- F) get_node_overview RPC
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_node_overview(addr TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  profile_row profiles%ROWTYPE;
  nodes_json JSONB;
  fixed_yield_total NUMERIC;
  pool_dividend_total NUMERIC;
  team_commission_total NUMERIC;
  pool_balance NUMERIC;
  pool_updated TIMESTAMPTZ;
BEGIN
  SELECT * INTO profile_row FROM profiles WHERE wallet_address = addr;
  IF profile_row.id IS NULL THEN
    RETURN jsonb_build_object('nodes', '[]'::JSONB, 'rewards', NULL, 'pool', NULL);
  END IF;

  -- Get all nodes with their milestones
  SELECT COALESCE(jsonb_agg(
    to_jsonb(nm) || jsonb_build_object(
      'milestones', COALESCE(
        (SELECT jsonb_agg(to_jsonb(ms) ORDER BY ms.milestone_index)
         FROM node_milestones ms WHERE ms.membership_id = nm.id),
        '[]'::JSONB
      )
    )
  ORDER BY nm.start_date DESC), '[]'::JSONB)
  INTO nodes_json
  FROM node_memberships nm
  WHERE nm.user_id = profile_row.id;

  -- Get reward totals
  SELECT COALESCE(SUM(amount), 0) INTO fixed_yield_total
  FROM node_rewards WHERE user_id = profile_row.id AND reward_type = 'FIXED_YIELD';

  SELECT COALESCE(SUM(amount), 0) INTO pool_dividend_total
  FROM node_rewards WHERE user_id = profile_row.id AND reward_type = 'POOL_DIVIDEND';

  SELECT COALESCE(SUM(amount), 0) INTO team_commission_total
  FROM node_rewards WHERE user_id = profile_row.id AND reward_type = 'TEAM_COMMISSION';

  -- Get NODE_POOL balance
  SELECT balance, updated_at INTO pool_balance, pool_updated
  FROM revenue_pools WHERE pool_name = 'NODE_POOL';

  RETURN jsonb_build_object(
    'nodes', nodes_json,
    'rewards', jsonb_build_object(
      'fixedYield', COALESCE(ROUND(fixed_yield_total, 2), 0)::TEXT,
      'poolDividend', COALESCE(ROUND(pool_dividend_total, 2), 0)::TEXT,
      'teamCommission', COALESCE(ROUND(team_commission_total, 2), 0)::TEXT,
      'totalEarnings', COALESCE(ROUND(fixed_yield_total + pool_dividend_total + team_commission_total, 2), 0)::TEXT
    ),
    'pool', jsonb_build_object(
      'balance', COALESCE(ROUND(pool_balance, 2), 0)::TEXT,
      'updatedAt', pool_updated
    )
  );
END;
$$;

-- ─────────────────────────────────────────────
-- G) Update settlement functions for earnings_capacity
-- ─────────────────────────────────────────────

-- settle_node_fixed_yield: multiply daily yield by earnings_capacity
CREATE OR REPLACE FUNCTION settle_node_fixed_yield()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  node RECORD;
  fixed_return NUMERIC;
  duration_days INT;
  daily_profit NUMERIC;
  total_settled NUMERIC := 0;
  nodes_processed INT := 0;
BEGIN
  FOR node IN
    SELECT nm.*, p.id AS profile_id
    FROM node_memberships nm
    JOIN profiles p ON p.id = nm.user_id
    WHERE nm.status IN ('ACTIVE', 'PENDING_MILESTONES')
      AND (nm.end_date IS NULL OR nm.end_date > NOW())
  LOOP
    IF node.node_type = 'MAX' THEN
      SELECT COALESCE(value::NUMERIC, 0.10) INTO fixed_return FROM system_config WHERE key = 'NODE_MAX_FIXED_RETURN';
      SELECT COALESCE(value::INT, 120) INTO duration_days FROM system_config WHERE key = 'NODE_MAX_DURATION_DAYS';
    ELSE
      SELECT COALESCE(value::NUMERIC, 0.10) INTO fixed_return FROM system_config WHERE key = 'NODE_MINI_FIXED_RETURN';
      SELECT COALESCE(value::INT, 90) INTO duration_days FROM system_config WHERE key = 'NODE_MINI_DURATION_DAYS';
    END IF;

    -- Scale by earnings_capacity
    daily_profit := node.price * fixed_return / duration_days * COALESCE(node.earnings_capacity, 1.0);

    IF daily_profit > 0 THEN
      INSERT INTO node_rewards (user_id, reward_type, amount, details)
      VALUES (node.user_id, 'FIXED_YIELD', daily_profit,
        jsonb_build_object('node_type', node.node_type, 'principal', node.price,
          'rate', fixed_return, 'duration', duration_days, 'earnings_capacity', node.earnings_capacity));

      total_settled := total_settled + daily_profit;
      nodes_processed := nodes_processed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('nodesProcessed', nodes_processed, 'totalSettled', ROUND(total_settled, 6)::TEXT);
END;
$$;

-- settle_node_pool_dividend: weight by earnings_capacity
CREATE OR REPLACE FUNCTION settle_node_pool_dividend()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  pool_balance NUMERIC;
  total_weight NUMERIC := 0;
  node RECORD;
  node_weight NUMERIC;
  dividend NUMERIC;
  user_keep_rate NUMERIC;
  team_pool_rate NUMERIC;
  user_amount NUMERIC;
  team_amount NUMERIC;
  max_multiplier NUMERIC;
  mini_multiplier NUMERIC;
  total_distributed NUMERIC := 0;
  nodes_processed INT := 0;
BEGIN
  SELECT balance INTO pool_balance FROM revenue_pools WHERE pool_name = 'NODE_POOL';
  IF pool_balance IS NULL OR pool_balance <= 0 THEN
    RETURN jsonb_build_object('poolBalance', 0, 'distributed', false);
  END IF;

  SELECT COALESCE(value::NUMERIC, 1.5) INTO max_multiplier FROM system_config WHERE key = 'NODE_MAX_WEIGHT_MULTIPLIER';
  SELECT COALESCE(value::NUMERIC, 1.0) INTO mini_multiplier FROM system_config WHERE key = 'NODE_MINI_WEIGHT_MULTIPLIER';
  SELECT COALESCE(value::NUMERIC, 0.90) INTO user_keep_rate FROM system_config WHERE key = 'NODE_DIVIDEND_USER_KEEP';
  SELECT COALESCE(value::NUMERIC, 0.10) INTO team_pool_rate FROM system_config WHERE key = 'NODE_DIVIDEND_TEAM_POOL';

  -- Only MAX nodes participate in revenue pool, weighted by earnings_capacity
  SELECT COALESCE(SUM(
    price * max_multiplier * COALESCE(earnings_capacity, 1.0)
  ), 0) INTO total_weight
  FROM node_memberships
  WHERE node_type = 'MAX'
    AND status IN ('ACTIVE', 'PENDING_MILESTONES')
    AND (end_date IS NULL OR end_date > NOW());

  IF total_weight <= 0 THEN
    RETURN jsonb_build_object('poolBalance', pool_balance::TEXT, 'distributed', false, 'reason', 'no_eligible_max_nodes');
  END IF;

  FOR node IN
    SELECT nm.*
    FROM node_memberships nm
    WHERE nm.node_type = 'MAX'
      AND nm.status IN ('ACTIVE', 'PENDING_MILESTONES')
      AND (nm.end_date IS NULL OR nm.end_date > NOW())
  LOOP
    node_weight := node.price * max_multiplier * COALESCE(node.earnings_capacity, 1.0);

    dividend := pool_balance * (node_weight / total_weight);
    user_amount := dividend * user_keep_rate;
    team_amount := dividend * team_pool_rate;

    INSERT INTO node_rewards (user_id, reward_type, amount, details)
    VALUES (node.user_id, 'POOL_DIVIDEND', user_amount,
      jsonb_build_object('node_type', node.node_type, 'weight', node_weight,
        'total_weight', total_weight, 'pool_balance', pool_balance,
        'gross_dividend', dividend, 'earnings_capacity', node.earnings_capacity));

    total_distributed := total_distributed + dividend;
    nodes_processed := nodes_processed + 1;
  END LOOP;

  UPDATE revenue_pools SET balance = balance - total_distributed, updated_at = NOW() WHERE pool_name = 'NODE_POOL';

  RETURN jsonb_build_object(
    'poolBalance', ROUND(pool_balance, 6)::TEXT,
    'distributed', true,
    'totalDistributed', ROUND(total_distributed, 6)::TEXT,
    'nodesProcessed', nodes_processed
  );
END;
$$;
