-- Enhance notifications table with related entity references
-- and additional notification types

-- Add columns for linking notifications to related entities (orders, conversations, etc.)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_type TEXT;

-- Add index for related entity lookups
CREATE INDEX IF NOT EXISTS idx_notifications_related ON public.notifications(account_id, related_type, related_id);

-- Drop the old check constraint if any, and update type to support more values
-- The type column is TEXT so it already supports any string value

-- Add INSERT policy for authenticated users (so API can create notifications)
CREATE POLICY "Users can insert own notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts WHERE id = auth.uid()
    )
  );
