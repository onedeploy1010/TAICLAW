-- =============================================
-- 007: Update Node Rules — New Contribution + Frozen Amount System
-- Large Node: $600 contribution + $6000 frozen, 0.9% daily, 120 days
-- Small Node: $100 contribution + $1000 frozen, 0.5% daily, 90 days
-- =============================================

-- A) Add new columns to node_memberships
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'node_memberships' AND column_name = 'contribution_amount'
  ) THEN
    ALTER TABLE node_memberships ADD COLUMN contribution_amount NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'node_memberships' AND column_name = 'frozen_amount'
  ) THEN
    ALTER TABLE node_memberships ADD COLUMN frozen_amount NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'node_memberships' AND column_name = 'daily_rate'
  ) THEN
    ALTER TABLE node_memberships ADD COLUMN daily_rate NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'node_memberships' AND column_name = 'locked_earnings'
  ) THEN
    ALTER TABLE node_memberships ADD COLUMN locked_earnings NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'node_memberships' AND column_name = 'released_earnings'
  ) THEN
    ALTER TABLE node_memberships ADD COLUMN released_earnings NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'node_memberships' AND column_name = 'available_balance'
  ) THEN
    ALTER TABLE node_memberships ADD COLUMN available_balance NUMERIC DEFAULT 0;
  END IF;
END;
$$;

-- A2) Backfill existing rows with correct values
UPDATE node_memberships
SET contribution_amount = CASE WHEN node_type = 'MAX' THEN 600 ELSE 100 END,
    frozen_amount = CASE WHEN node_type = 'MAX' THEN 6000 ELSE 1000 END,
    daily_rate = CASE WHEN node_type = 'MAX' THEN 0.009 ELSE 0.005 END
WHERE contribution_amount = 0 OR contribution_amount IS NULL;

-- B) Update milestone configs in system_config
INSERT INTO system_config (key, value) VALUES
  ('MINI_MILESTONES', '[
    {"rank":"V2","days":15,"unlocks":"earnings","desc":"Unlock daily 0.5% earnings"},
    {"rank":"V4","days":90,"unlocks":"earnings_and_package","desc":"Withdraw 1000 USDC equivalent MA"}
  ]'),
  ('MAX_MILESTONES', '[
    {"rank":"V1","days":15,"unlocks":"none","desc":"Reach V1"},
    {"rank":"V2","days":30,"unlocks":"earnings","desc":"100U holding + 3 small node referrals"},
    {"rank":"V3","days":45,"unlocks":"earnings","desc":"500U holding / 45 days"},
    {"rank":"V4","days":60,"unlocks":"earnings","desc":"500U holding / 45 days"},
    {"rank":"V5","days":90,"unlocks":"earnings","desc":"500U holding / 45 days"},
    {"rank":"V6","days":120,"unlocks":"earnings_and_package","desc":"1000U holding / 45 days, unlock all"}
  ]'),
  ('NODE_MAX_CONTRIBUTION', '600'),
  ('NODE_MAX_FROZEN', '6000'),
  ('NODE_MAX_DAILY_RATE', '0.009'),
  ('NODE_MINI_CONTRIBUTION', '100'),
  ('NODE_MINI_FROZEN', '1000'),
  ('NODE_MINI_DAILY_RATE', '0.005')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- C) Replace purchase_node RPC with new contribution + frozen logic
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
  contribution NUMERIC;
  frozen NUMERIC;
  daily_rate_val NUMERIC;
  node_duration INT;
  membership node_memberships%ROWTYPE;
  milestones_json JSONB;
  milestone JSONB;
  m_index INT := 0;
  total_m INT;
  highest_node TEXT;
BEGIN
  SELECT * INTO profile_row FROM profiles WHERE wallet_address = addr;
  IF profile_row.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF node_type_param = 'MAX' THEN
    contribution := 600;
    frozen := 6000;
    daily_rate_val := 0.009;
    node_duration := 120;
    SELECT value::JSONB INTO milestones_json FROM system_config WHERE key = 'MAX_MILESTONES';
  ELSE
    contribution := 100;
    frozen := 1000;
    daily_rate_val := 0.005;
    node_duration := 90;
    SELECT value::JSONB INTO milestones_json FROM system_config WHERE key = 'MINI_MILESTONES';
  END IF;

  total_m := jsonb_array_length(COALESCE(milestones_json, '[]'::JSONB));

  INSERT INTO node_memberships (
    user_id, node_type, price, contribution_amount, frozen_amount, daily_rate,
    status, start_date, end_date,
    payment_mode, deposit_amount, milestone_stage, total_milestones, earnings_capacity,
    locked_earnings, released_earnings, available_balance
  )
  VALUES (
    profile_row.id, node_type_param, contribution + frozen,
    contribution, frozen, daily_rate_val,
    'PENDING_MILESTONES', NOW(), NOW() + (node_duration || ' days')::INTERVAL,
    'FULL', contribution, 0, total_m, 0.0,
    0, 0, 0
  )
  RETURNING * INTO membership;

  IF milestones_json IS NOT NULL THEN
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
  END IF;

  INSERT INTO transactions (user_id, type, token, amount, tx_hash, status, details)
  VALUES (profile_row.id, 'NODE_PURCHASE', 'USDC', contribution + frozen, tx_hash, 'CONFIRMED',
    jsonb_build_object('node_type', node_type_param, 'contribution', contribution, 'frozen', frozen));

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

-- D) Update get_node_overview to include new fields
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
  total_available NUMERIC;
  total_locked NUMERIC;
  total_released NUMERIC;
BEGIN
  SELECT * INTO profile_row FROM profiles WHERE wallet_address = addr;
  IF profile_row.id IS NULL THEN
    RETURN jsonb_build_object(
      'nodes', '[]'::JSONB, 'rewards', NULL, 'pool', NULL,
      'rank', 'V0', 'availableBalance', '0', 'lockedEarnings', '0', 'releasedEarnings', '0'
    );
  END IF;

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

  SELECT COALESCE(SUM(amount), 0) INTO fixed_yield_total
  FROM node_rewards WHERE user_id = profile_row.id AND reward_type = 'FIXED_YIELD';

  SELECT COALESCE(SUM(amount), 0) INTO pool_dividend_total
  FROM node_rewards WHERE user_id = profile_row.id AND reward_type = 'POOL_DIVIDEND';

  SELECT COALESCE(SUM(amount), 0) INTO team_commission_total
  FROM node_rewards WHERE user_id = profile_row.id AND reward_type = 'TEAM_COMMISSION';

  SELECT balance, updated_at INTO pool_balance, pool_updated
  FROM revenue_pools WHERE pool_name = 'NODE_POOL';

  SELECT
    COALESCE(SUM(available_balance), 0),
    COALESCE(SUM(locked_earnings), 0),
    COALESCE(SUM(released_earnings), 0)
  INTO total_available, total_locked, total_released
  FROM node_memberships
  WHERE user_id = profile_row.id AND status IN ('ACTIVE', 'PENDING_MILESTONES');

  RETURN jsonb_build_object(
    'nodes', nodes_json,
    'rank', COALESCE(profile_row.rank, 'V0'),
    'availableBalance', COALESCE(ROUND(total_available, 2), 0)::TEXT,
    'lockedEarnings', COALESCE(ROUND(total_locked, 2), 0)::TEXT,
    'releasedEarnings', COALESCE(ROUND(total_released, 2), 0)::TEXT,
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

-- E) Update settlement: use daily_rate from membership directly
CREATE OR REPLACE FUNCTION settle_node_fixed_yield()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  node RECORD;
  daily_profit NUMERIC;
  total_settled NUMERIC := 0;
  nodes_processed INT := 0;
BEGIN
  FOR node IN
    SELECT nm.*, p.id AS profile_id, p.rank AS user_rank
    FROM node_memberships nm
    JOIN profiles p ON p.id = nm.user_id
    WHERE nm.status IN ('ACTIVE', 'PENDING_MILESTONES')
      AND (nm.end_date IS NULL OR nm.end_date > NOW())
  LOOP
    daily_profit := node.frozen_amount * COALESCE(node.daily_rate, 0) * COALESCE(node.earnings_capacity, 0);

    IF node.node_type = 'MINI' AND node.milestone_stage < 1 THEN
      UPDATE node_memberships
      SET locked_earnings = locked_earnings + daily_profit
      WHERE id = node.id;
    ELSE
      IF daily_profit > 0 THEN
        UPDATE node_memberships
        SET released_earnings = released_earnings + daily_profit,
            available_balance = available_balance + daily_profit
        WHERE id = node.id;

        INSERT INTO node_rewards (user_id, reward_type, amount, details)
        VALUES (node.user_id, 'FIXED_YIELD', daily_profit,
          jsonb_build_object('node_type', node.node_type, 'frozen_amount', node.frozen_amount,
            'daily_rate', node.daily_rate, 'earnings_capacity', node.earnings_capacity));
      END IF;
    END IF;

    total_settled := total_settled + daily_profit;
    nodes_processed := nodes_processed + 1;
  END LOOP;

  RETURN jsonb_build_object('nodesProcessed', nodes_processed, 'totalSettled', ROUND(total_settled, 6)::TEXT);
END;
$$;

-- F) Update check_node_milestones for new rules
CREATE OR REPLACE FUNCTION check_node_milestones(addr TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  profile_row profiles%ROWTYPE;
  ms RECORD;
  user_rank_index INT;
  required_rank_index INT;
  achieved_count INT := 0;
  failed_count INT := 0;
BEGIN
  SELECT * INTO profile_row FROM profiles WHERE wallet_address = addr;
  IF profile_row.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  FOR ms IN
    SELECT nm_ms.*, nm.user_id, nm.node_type, nm.total_milestones, nm.id AS mem_id,
           nm.locked_earnings, nm.frozen_amount
    FROM node_milestones nm_ms
    JOIN node_memberships nm ON nm.id = nm_ms.membership_id
    WHERE nm.user_id = profile_row.id
      AND nm.status = 'PENDING_MILESTONES'
      AND nm_ms.status = 'PENDING'
    ORDER BY nm_ms.milestone_index ASC
  LOOP
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
      UPDATE node_milestones SET status = 'ACHIEVED', achieved_at = NOW()
      WHERE id = ms.id;

      UPDATE node_memberships
      SET milestone_stage = milestone_stage + 1,
          earnings_capacity = LEAST(earnings_capacity + (1.0 / ms.total_milestones), 1.0)
      WHERE id = ms.mem_id;

      IF ms.node_type = 'MINI' AND ms.required_rank = 'V2' THEN
        UPDATE node_memberships
        SET released_earnings = released_earnings + COALESCE(locked_earnings, 0),
            available_balance = available_balance + COALESCE(locked_earnings, 0),
            locked_earnings = 0
        WHERE id = ms.mem_id;
      END IF;

      achieved_count := achieved_count + 1;

    ELSIF NOW() > ms.deadline_at THEN
      UPDATE node_milestones SET status = 'FAILED'
      WHERE id = ms.id;

      UPDATE node_milestones SET status = 'FAILED'
      WHERE membership_id = ms.mem_id AND status = 'PENDING';

      UPDATE node_memberships
      SET status = 'CANCELLED',
          locked_earnings = 0,
          available_balance = 0
      WHERE id = ms.mem_id;

      failed_count := failed_count + 1;
    END IF;
  END LOOP;

  UPDATE node_memberships
  SET status = 'ACTIVE'
  WHERE user_id = profile_row.id
    AND status = 'PENDING_MILESTONES'
    AND milestone_stage >= total_milestones;

  IF EXISTS (
    SELECT 1 FROM node_memberships
    WHERE user_id = profile_row.id AND node_type = 'MAX' AND status = 'ACTIVE'
      AND milestone_stage >= total_milestones
  ) THEN
    UPDATE node_memberships
    SET available_balance = available_balance + frozen_amount,
        frozen_amount = 0
    WHERE user_id = profile_row.id AND node_type = 'MAX' AND status = 'ACTIVE'
      AND milestone_stage >= total_milestones AND frozen_amount > 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM node_memberships
    WHERE user_id = profile_row.id AND node_type = 'MINI' AND status = 'ACTIVE'
      AND milestone_stage >= total_milestones
  ) THEN
    UPDATE node_memberships
    SET available_balance = available_balance + frozen_amount,
        frozen_amount = 0
    WHERE user_id = profile_row.id AND node_type = 'MINI' AND status = 'ACTIVE'
      AND milestone_stage >= total_milestones AND frozen_amount > 0;
  END IF;

  UPDATE profiles SET node_type = (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM node_memberships WHERE user_id = profile_row.id AND node_type = 'MAX' AND status IN ('ACTIVE', 'PENDING_MILESTONES'))
      THEN 'MAX'
      WHEN EXISTS (SELECT 1 FROM node_memberships WHERE user_id = profile_row.id AND node_type = 'MINI' AND status IN ('ACTIVE', 'PENDING_MILESTONES'))
      THEN 'MINI'
      ELSE 'NONE'
    END
  ) WHERE id = profile_row.id;

  RETURN jsonb_build_object('achieved', achieved_count, 'failed', failed_count);
END;
$$;
