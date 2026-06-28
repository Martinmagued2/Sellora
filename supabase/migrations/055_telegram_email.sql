-- Migration 055: Telegram + Email channel support
--
-- Adds columns for Telegram bot integration + email channel:
-- - Telegram: bot token, connected status
-- - Email: inbound email address, IMAP settings (optional)

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS telegram_bot_token text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS telegram_connected boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS telegram_bot_username text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS telegram_webhook_verified boolean DEFAULT false;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_channel_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_inbound_address text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_imap_host text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_imap_port integer DEFAULT 993;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_imap_user text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_imap_password text;

-- Add telegram + email to the channel CHECK constraint on conversations
-- (if it exists, alter it; otherwise just allow any text)
DO $$ BEGIN
  ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_channel_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add telegram + email to messages type constraint
DO $$ BEGIN
  ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add telegram + email to customers channel constraint
DO $$ BEGIN
  ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_channel_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add telegram + email to orders channel constraint
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_channel_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
