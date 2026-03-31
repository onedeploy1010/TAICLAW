-- =============================================
-- 008: Node Milestone Requirements Check RPC
-- Returns vault deposited amount and direct node referral count
-- Used for milestone activation requirement checking
-- =============================================

CREATE OR REPLACE FUNCTION get_node_milestone_requirements(addr TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_vault_deposited NUMERIC := 0;
  v_direct_node_referrals INT := 0;
BEGIN
  SELECT id INTO v_user_id
  FROM profiles
  WHERE wallet_address = lower(addr);

  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'vault_deposited', 0,
      'direct_node_referrals', 0
    );
  END IF;

  SELECT COALESCE(SUM(principal), 0) INTO v_vault_deposited
  FROM vault_positions
  WHERE user_id = v_user_id
    AND status IN ('ACTIVE', 'COMPLETED');

  SELECT COUNT(*) INTO v_direct_node_referrals
  FROM node_memberships nm
  JOIN profiles p ON p.id = nm.user_id
  WHERE p.referrer_id = v_user_id
    AND nm.status IN ('ACTIVE', 'PENDING_MILESTONES');

  RETURN json_build_object(
    'vault_deposited', v_vault_deposited,
    'direct_node_referrals', v_direct_node_referrals
  );
END;
$$;
