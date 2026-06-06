ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_secret text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_backup_codes jsonb DEFAULT '[]';
