/**
 * Admin Migration Endpoint
 * POST /api/admin/migrate
 * 
 * Runs database migrations for new features.
 * Uses the Supabase service role key to execute raw SQL.
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
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

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(req) {
  try {
    const { adminKey } = await req.json();
    
    // 🔒 SECURITY: Use timing-safe comparison instead of !==
    if (!timingSafeKeyCompare(adminKey, process.env.ADMIN_SECRET_KEY || "")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getAdminClient();
    const results = [];

    // Migration 1: Create notifications table
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      query: `
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
      `
    });

    if (createTableError) {
      // RPC might not exist, try direct approach
      results.push({ step: "create_notifications_table", status: "rpc_not_available", error: createTableError.message });
      
      // Fallback: Try creating the table using individual operations
      // Check if table exists first
      const { data: tableCheck } = await supabase
        .from("notifications")
        .select("id")
        .limit(1);
      
      if (tableCheck !== null) {
        results.push({ step: "notifications_table_exists", status: "already_exists" });
      } else {
        results.push({ step: "notifications_table", status: "needs_manual_creation", note: "Table needs to be created via Supabase Dashboard SQL Editor" });
      }
    } else {
      results.push({ step: "create_notifications_table", status: "success" });
    }

    // Migration 2: Add notify_escalations column to accounts
    // Try to update any account to see if column exists
    const { error: columnCheckError } = await supabase
      .from("accounts")
      .select("notify_escalations")
      .limit(1);

    if (columnCheckError && columnCheckError.message.includes("does not exist")) {
      results.push({ step: "add_notify_escalations_column", status: "needs_manual_creation", note: "Add column via: ALTER TABLE accounts ADD COLUMN notify_escalations BOOLEAN DEFAULT true" });
    } else {
      results.push({ step: "notify_escalations_column", status: "already_exists" });
    }

    // Migration 3: Check if 'needs_attention' status is supported
    // Try to update a conversation to needs_attention status
    const { data: testConv } = await supabase
      .from("conversations")
      .select("id, status")
      .limit(1)
      .single();

    if (testConv) {
      const { error: statusError } = await supabase
        .from("conversations")
        .update({ status: "needs_attention" })
        .eq("id", testConv.id);

      if (statusError && statusError.message.includes("check constraint")) {
        results.push({ step: "needs_attention_status", status: "needs_manual_creation", note: "Run: ALTER TABLE conversations DROP CONSTRAINT conversations_status_check; ALTER TABLE conversations ADD CONSTRAINT conversations_status_check CHECK (status IN ('new','open','in_progress','waiting_customer','resolved','closed','needs_attention'));" });
      } else {
        // Revert the test change
        await supabase
          .from("conversations")
          .update({ status: testConv.status })
          .eq("id", testConv.id);
        results.push({ step: "needs_attention_status", status: "already_supported" });
      }
    }

    // Summary
    const needsManual = results.filter(r => r.status === "needs_manual_creation");
    results.push({
      step: "summary",
      status: needsManual.length === 0 ? "all_migrations_applied" : "some_need_manual_action",
      manual_steps_needed: needsManual.length,
      manual_steps: needsManual.map(r => r.note || r.step),
    });

    return Response.json({ results });
  } catch (err) {
    console.error("[MIGRATE] Error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
