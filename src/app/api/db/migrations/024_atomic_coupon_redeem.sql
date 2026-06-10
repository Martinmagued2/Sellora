-- Migration 024: Atomic coupon redemption RPC function
-- Prevents race conditions in coupon used_count increment by using
-- a database-level atomic UPDATE ... SET used_count = used_count + 1

CREATE OR REPLACE FUNCTION redeem_coupon_atomic(p_coupon_id UUID)
RETURNS TABLE(id UUID, code TEXT, used_count INTEGER, max_uses INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_coupon RECORD;
BEGIN
  -- Atomic increment with concurrency guard
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE id = p_coupon_id
    AND is_active = true
    AND (max_uses IS NULL OR used_count < max_uses)
  RETURNING id, code, used_count, max_uses INTO v_coupon;

  IF v_coupon IS NULL THEN
    -- Coupon not found, inactive, or usage limit reached
    RETURN;
  END IF;

  -- Return the updated coupon data
  RETURN QUERY SELECT v_coupon.id, v_coupon.code, v_coupon.used_count, v_coupon.max_uses;
END;
$$;

-- Also add a function for atomic subscription extension
-- Prevents race conditions when two webhooks arrive concurrently for the same account
CREATE OR REPLACE FUNCTION extend_subscription(
  p_account_id UUID,
  p_plan TEXT,
  p_days INTEGER,
  p_paymob_order_id TEXT DEFAULT NULL,
  p_payment_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_ends_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_end TIMESTAMPTZ;
  v_base_date TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Read current subscription end atomically within the transaction
  SELECT subscription_ends_at INTO v_current_end
  FROM accounts WHERE id = p_account_id
  FOR UPDATE; -- Row-level lock prevents concurrent modification

  -- Base date is the later of NOW() and current end
  v_base_date := GREATEST(v_now, COALESCE(v_current_end, v_now));

  -- Calculate new end date
  v_new_end := v_base_date + (p_days || ' days')::INTERVAL;

  -- Update the account
  UPDATE accounts SET
    plan = p_plan,
    plan_status = 'active',
    subscription_started_at = v_now,
    subscription_ends_at = v_new_end,
    paymob_order_id = COALESCE(p_paymob_order_id, paymob_order_id),
    last_payment_at = v_now,
    updated_at = v_now
  WHERE id = p_account_id;

  -- Mark the payment as success if payment_id provided
  IF p_payment_id IS NOT NULL THEN
    UPDATE payments SET
      status = 'success',
      updated_at = v_now
    WHERE id = p_payment_id
      AND status = 'pending'; -- Only update if still pending (idempotency)
  END IF;

  RETURN QUERY SELECT true AS success, v_new_end AS new_ends_at;
END;
$$;
