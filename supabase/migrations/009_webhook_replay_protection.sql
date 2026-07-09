-- 009_webhook_replay_protection.sql
-- Enforce uniqueness on platform message IDs to prevent webhook replay attacks

-- Prevent duplicate WhatsApp messages
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_whatsapp_id_unique 
ON messages(whatsapp_message_id) 
WHERE whatsapp_message_id IS NOT NULL;

-- Prevent duplicate messages from Facebook/Instagram
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_platform_id_unique 
ON messages(platform_message_id) 
WHERE platform_message_id IS NOT NULL;
