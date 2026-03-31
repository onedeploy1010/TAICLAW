-- Update VIP price: $69/month
CREATE OR REPLACE FUNCTION subscribe_vip(addr TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  profile_row profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile_row FROM profiles WHERE wallet_address = addr;
  IF profile_row.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  UPDATE profiles SET is_vip = TRUE, vip_expires_at = NOW() + INTERVAL '1 month'
  WHERE id = profile_row.id
  RETURNING * INTO profile_row;

  INSERT INTO transactions (user_id, type, token, amount, status)
  VALUES (profile_row.id, 'VIP_PURCHASE', 'USDT', '69', 'CONFIRMED');

  RETURN to_jsonb(profile_row);
END;
$$;
