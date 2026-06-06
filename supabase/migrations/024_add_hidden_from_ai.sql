-- Add hidden_from_ai flag to products table
-- Used by inventory alerts to hide out-of-stock products from AI recommendations

ALTER TABLE products ADD COLUMN IF NOT EXISTS hidden_from_ai boolean DEFAULT false;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_products_hidden_from_ai ON products(hidden_from_ai) WHERE hidden_from_ai = true;
