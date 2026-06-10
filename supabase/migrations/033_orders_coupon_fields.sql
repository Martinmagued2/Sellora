-- Add coupon-related fields to the orders table
-- This allows orders to track which coupon was applied, the discount amount, and pre-discount subtotal

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2);

-- Add comment for documentation
COMMENT ON COLUMN orders.coupon_id IS 'The coupon applied to this order';
COMMENT ON COLUMN orders.coupon_code IS 'The coupon code at time of application (snapshot, in case coupon is later changed)';
COMMENT ON COLUMN orders.discount_amount IS 'The discount amount in the order currency';
COMMENT ON COLUMN orders.subtotal IS 'The pre-discount total (before coupon was applied)';

-- Create index for coupon lookups on orders
CREATE INDEX IF NOT EXISTS idx_orders_coupon_id ON orders(coupon_id);
CREATE INDEX IF NOT EXISTS idx_orders_coupon_code ON orders(coupon_code);
