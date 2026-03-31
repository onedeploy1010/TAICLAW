-- Update node prices: MINI=$1,000, MAX=$6,000
CREATE OR REPLACE FUNCTION purchase_node(addr TEXT, node_type_param TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  profile_row profiles%ROWTYPE;
  node_price NUMERIC;
  membership node_memberships%ROWTYPE;
BEGIN
  SELECT * INTO profile_row FROM profiles WHERE wallet_address = addr;
  IF profile_row.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF node_type_param = 'MAX' THEN node_price := 6000;
  ELSE node_price := 1000;
  END IF;

  INSERT INTO node_memberships (user_id, node_type, price, status)
  VALUES (profile_row.id, node_type_param, node_price, 'ACTIVE')
  RETURNING * INTO membership;

  UPDATE profiles SET node_type = node_type_param WHERE id = profile_row.id;

  INSERT INTO transactions (user_id, type, token, amount, status)
  VALUES (profile_row.id, 'NODE_PURCHASE', 'USDT', node_price, 'CONFIRMED');

  RETURN to_jsonb(membership);
END;
$$;
