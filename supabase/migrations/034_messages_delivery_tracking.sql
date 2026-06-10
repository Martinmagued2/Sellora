-- Migration 034: Add delivery tracking columns to messages table
-- These columns are referenced by processor.js, copilot-tools.js, and other message insert code
-- but were previously only created by the /api/db/migrate auto-migration endpoint.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status TEXT
  CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed'));

ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;

-- Add phone column to customers for WhatsApp customers
-- Previously WhatsApp phone numbers were only stored in platform_id
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone TEXT;

-- Backfill phone from platform_id for existing WhatsApp customers who don't have phone set
UPDATE customers
SET phone = platform_id
WHERE channel = 'whatsapp' AND phone IS NULL AND platform_id IS NOT NULL;
