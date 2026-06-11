-- Create notifications table for AI escalation alerts
-- This stores in-app notifications that appear in the owner's dashboard

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'ai_escalation',
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by account
CREATE INDEX IF NOT EXISTS idx_notifications_account_id ON public.notifications(account_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(account_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(account_id, type);

-- Add escalation notification setting to accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS notify_escalations BOOLEAN DEFAULT true;

-- Add 'needs_attention' to the allowed conversation statuses
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_status_check' 
    AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE public.conversations DROP CONSTRAINT conversations_status_check;
  END IF;
END $$;

ALTER TABLE public.conversations 
ADD CONSTRAINT conversations_status_check 
CHECK (status IN ('new', 'open', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'needs_attention'));

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own notifications (account_id = their user id from auth)
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE id = auth.uid()
    )
  );

-- Policy: Service role can do everything (used by webhook processor)
CREATE POLICY "Service role full access" ON public.notifications
  FOR ALL USING (true) WITH CHECK (true);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE id = auth.uid()
    )
  );
