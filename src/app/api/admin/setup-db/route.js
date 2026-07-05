/**
 * Database Setup Endpoint
 * GET /api/admin/setup-db?adminKey=<ADMIN_SECRET_KEY>
 * 
 * Checks what migrations are needed and provides the SQL to run manually.
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// 🔒 SECURITY: Timing-safe admin key comparison
function timingSafeKeyCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // Constant-time dummy
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const adminKey = searchParams.get("adminKey");
  
  // 🔒 SECURITY: Use timing-safe comparison instead of !==
  if (!timingSafeKeyCompare(adminKey, process.env.ADMIN_SECRET_KEY || "")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const checks = [];

  // Check 1: notifications table
  const { error: notifError } = await supabase.from("notifications").select("id").limit(1);
  checks.push({
    name: "notifications_table",
    exists: !notifError || !notifError.message.includes("does not exist"),
    error: notifError?.message,
  });

  // Check 2: notify_escalations column
  const { error: colError } = await supabase.from("accounts").select("notify_escalations").limit(1);
  checks.push({
    name: "notify_escalations_column",
    exists: !colError || !colError.message.includes("does not exist"),
    error: colError?.message,
  });

  // Check 3: needs_attention status
  const { data: testConv } = await supabase.from("conversations").select("id, status").limit(1).single();
  let statusSupported = false;
  if (testConv) {
    const { error: statusError } = await supabase.from("conversations").update({ status: "needs_attention" }).eq("id", testConv.id);
    if (!statusError) {
      await supabase.from("conversations").update({ status: testConv.status }).eq("id", testConv.id);
      statusSupported = true;
    }
  }
  checks.push({
    name: "needs_attention_status",
    exists: statusSupported,
  });

  const needsMigration = checks.filter(c => !c.exists);
  const allApplied = needsMigration.length === 0;

  return Response.json({
    all_migrations_applied: allApplied,
    checks,
    needs_migration: needsMigration.map(c => c.name),
    sql_to_run: allApplied ? null : `-- Run this in Supabase Dashboard → SQL Editor:
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
CREATE INDEX IF NOT EXISTS idx_notifications_account_id ON public.notifications(account_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(account_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(account_id, type);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS notify_escalations BOOLEAN DEFAULT true;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_status_check' AND conrelid = 'public.conversations'::regclass) THEN
    ALTER TABLE public.conversations DROP CONSTRAINT conversations_status_check;
  END IF;
END $$;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_status_check CHECK (status IN ('new','open','in_progress','waiting_customer','resolved','closed','needs_attention'));`,
  });
}
