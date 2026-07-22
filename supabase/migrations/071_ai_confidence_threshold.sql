-- 071_ai_confidence_threshold.sql
-- Adds a column to control the AI Auto Reply Approval feature.
--
-- When ai_confidence_threshold > 0, AI replies with confidence below the
-- threshold are queued for human approval instead of being sent automatically.
--
-- Values:
--   0    = Auto-send all AI replies (default — current behavior)
--   50   = Only auto-send replies with confidence >= 50%
--   80   = Conservative — only auto-send high-confidence replies
--   100  = Never auto-send (all replies need approval)
--
-- The confidence score is computed heuristically in src/lib/ai/index.js
-- based on: reply length, presence of hedge words, fallback status, tool usage.

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ai_confidence_threshold INTEGER DEFAULT 0;

COMMENT ON COLUMN accounts.ai_confidence_threshold IS 'AI auto-reply confidence threshold (0-100). Replies below this are queued for human approval. 0 = auto-send all.';
