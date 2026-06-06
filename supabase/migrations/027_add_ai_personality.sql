-- Add comprehensive AI personality fields to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_name text DEFAULT 'Sellora AI';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_avatar text DEFAULT '🤖';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_personality_type text DEFAULT 'friendly';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_custom_description text DEFAULT '';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_formality integer DEFAULT 5;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_enthusiasm integer DEFAULT 7;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_verbosity integer DEFAULT 5;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_empathy integer DEFAULT 7;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_max_response_length integer DEFAULT 500;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_auto_suggest_products boolean DEFAULT true;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_auto_collect_email boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_auto_collect_phone boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_escalation_keywords jsonb DEFAULT '["human", "agent", "manager", "complaint"]';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_forbidden_topics jsonb DEFAULT '[]';
