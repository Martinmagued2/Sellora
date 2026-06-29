-- Migration 053: Customer CRM — notes, tasks, timeline, custom fields, health score
--
-- Adds full CRM capabilities to the customers feature:
-- 1. Customer notes (internal, separate from conversation notes)
-- 2. Follow-up tasks/reminders per customer
-- 3. Activity timeline (auto-tracked + manual events)
-- 4. Custom fields (merchant-defined per-account)
-- 5. Customer health score (auto-calculated)
-- 6. Lifecycle stages (lead → prospect → customer → churned → reactivated)

-- ============================================
-- Lifecycle stage + health score on customers
-- ============================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifecycle_stage text DEFAULT 'lead'
  CHECK (lifecycle_stage IN ('lead', 'prospect', 'customer', 'churned', 'reactivated'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS health_score numeric DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS health_score_updated_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS next_followup_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes_internal text;

-- ============================================
-- 1. Customer notes (internal, CRM-style)
-- ============================================
CREATE TABLE IF NOT EXISTS customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  author_id uuid, -- user.id of the team member who wrote it
  author_name text,
  body text NOT NULL,
  pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custnotes_customer ON customer_notes(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custnotes_account ON customer_notes(account_id);

-- ============================================
-- 2. Follow-up tasks/reminders
-- ============================================
CREATE TABLE IF NOT EXISTS customer_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  assigned_to uuid, -- user.id of team member
  assigned_name text,
  title text NOT NULL,
  description text,
  due_date timestamptz,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custtasks_customer ON customer_tasks(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_custtasks_account ON customer_tasks(account_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_custtasks_assigned ON customer_tasks(assigned_to, status);

-- ============================================
-- 3. Activity timeline
-- ============================================
CREATE TABLE IF NOT EXISTS customer_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL, -- 'message', 'order', 'review', 'note', 'task', 'tag_added', 'tag_removed', 'stage_change', 'email', 'call', 'meeting', 'manual'
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}',
  actor_id uuid, -- who performed the action (null for system)
  actor_name text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_timeline_customer ON customer_timeline(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_account ON customer_timeline(account_id, created_at DESC);

-- ============================================
-- 4. Custom fields (merchant-defined per account)
-- ============================================
CREATE TABLE IF NOT EXISTS customer_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean', 'textarea')),
  field_options jsonb DEFAULT '[]', -- for select type
  is_required boolean DEFAULT false,
  is_visible boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, field_name)
);
CREATE INDEX IF NOT EXISTS idx_customfields_account ON customer_custom_fields(account_id, sort_order);

-- ============================================
-- 5. Custom field values (per customer)
-- ============================================
CREATE TABLE IF NOT EXISTS customer_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  field_id uuid REFERENCES customer_custom_fields(id) ON DELETE CASCADE NOT NULL,
  value text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_fieldvalues_customer ON customer_field_values(customer_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own customer_notes" ON customer_notes
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE customer_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own customer_tasks" ON customer_tasks
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE customer_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own customer_timeline" ON customer_timeline
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE customer_custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own customer_custom_fields" ON customer_custom_fields
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

ALTER TABLE customer_field_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own customer_field_values" ON customer_field_values
  FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
