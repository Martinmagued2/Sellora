-- 062_task_comments.sql
-- Adds comments + file attachments to customer tasks, plus the new status workflow:
--   unseen → seen → in_progress → review → done | rejected
-- Also adds a seen_at timestamp for tracking when the assignee first viewed the task.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_tasks') THEN
    -- New status workflow columns
    EXECUTE 'ALTER TABLE customer_tasks ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ';
    EXECUTE 'ALTER TABLE customer_tasks ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ';
    EXECUTE 'ALTER TABLE customer_tasks ADD COLUMN IF NOT EXISTS completed_by UUID';
    EXECUTE 'ALTER TABLE customer_tasks ADD COLUMN IF NOT EXISTS reviewed_by UUID';
    EXECUTE 'ALTER TABLE customer_tasks ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ';
    EXECUTE 'ALTER TABLE customer_tasks ADD COLUMN IF NOT EXISTS review_notes TEXT';

    -- Drop the old status check constraint (if it exists) and replace with the new workflow
    EXECUTE 'ALTER TABLE customer_tasks DROP CONSTRAINT IF EXISTS customer_tasks_status_check';
    EXECUTE 'ALTER TABLE customer_tasks ADD CONSTRAINT customer_tasks_status_check
      CHECK (status IN (''unseen'', ''seen'', ''in_progress'', ''review'', ''done'', ''rejected'', ''pending'', ''completed'', ''cancelled''))';

    -- Backfill: any existing 'pending' task becomes 'unseen' (so the assignee gets the new state)
    EXECUTE 'UPDATE customer_tasks SET status = ''unseen'' WHERE status = ''pending''';
  END IF;

  -- task_comments table (NEW)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_comments') THEN
    EXECUTE 'CREATE TABLE task_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES customer_tasks(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      author_id UUID NOT NULL,
      author_name TEXT,
      body TEXT,
      link_url TEXT,
      link_label TEXT,
      file_url TEXT,
      file_name TEXT,
      file_size BIGINT,
      file_mime_type TEXT,
      is_internal BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )';
    EXECUTE 'CREATE INDEX idx_task_comments_task ON task_comments(task_id, created_at)';
    EXECUTE 'CREATE INDEX idx_task_comments_author ON task_comments(author_id)';
  END IF;

  -- Enable RLS on task_comments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_comments') THEN
    EXECUTE 'ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS task_comments_team_read ON task_comments';
    EXECUTE 'CREATE POLICY task_comments_team_read ON task_comments
      FOR SELECT USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS task_comments_team_insert ON task_comments';
    EXECUTE 'CREATE POLICY task_comments_team_insert ON task_comments
      FOR INSERT WITH CHECK (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS task_comments_team_update ON task_comments';
    EXECUTE 'CREATE POLICY task_comments_team_update ON task_comments
      FOR UPDATE USING (is_team_member(account_id))';
    EXECUTE 'DROP POLICY IF EXISTS task_comments_team_delete ON task_comments';
    EXECUTE 'CREATE POLICY task_comments_team_delete ON task_comments
      FOR DELETE USING (is_team_member(account_id))';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON task_comments TO authenticated';
  END IF;
END $$;

-- Done.
