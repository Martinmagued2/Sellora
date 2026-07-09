/**
 * AI Safety Settings API
 *
 * GET  /api/ai-safety/settings  — fetch the current account's AI safety settings
 * PUT  /api/ai-safety/settings  — update the AI safety settings
 *
 * Managed settings:
 *   - ai_confidence_threshold  (0-100, default 70) — below this, AI replies
 *     are held for human review instead of being sent.
 *   - ai_preview_mode          (boolean, default false) — when true, ALL AI
 *     replies are held for owner approval before being sent.
 *   - ai_high_value_threshold  (numeric, default 1000) — orders above this
 *     total are saved as pending_actions for owner approval instead of
 *     being auto-created.
 *   - ai_sla_hours             (integer > 0, default 4) — SLA window used
 *     when a conversation is escalated to a human.
 */

import { createClient } from "@/lib/supabase/server";

const ALLOWED_FIELDS = [
  "ai_confidence_threshold",
  "ai_preview_mode",
  "ai_high_value_threshold",
  "ai_sla_hours",
];

const DEFAULTS = {
  ai_confidence_threshold: 70,
  ai_preview_mode: false,
  ai_high_value_threshold: 1000,
  ai_sla_hours: 4,
};

function coerceValue(field, value) {
  if (value === undefined || value === null) return undefined;
  switch (field) {
    case "ai_confidence_threshold": {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || n > 100) return null; // invalid
      return Math.round(n);
    }
    case "ai_preview_mode":
      return Boolean(value);
    case "ai_high_value_threshold": {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return null;
      return n;
    }
    case "ai_sla_hours": {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
      return n;
    }
    default:
      return undefined;
  }
}

// GET: fetch current settings
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("accounts")
      .select(ALLOWED_FIELDS.join(", "))
      .eq("id", user.id)
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Apply defaults for null/missing values (e.g. before migration 056 runs)
    const settings = {};
    for (const field of ALLOWED_FIELDS) {
      settings[field] = data?.[field] ?? DEFAULTS[field];
    }

    return Response.json({ settings });
  } catch (err) {
    console.error("AI safety settings GET error:", err);
    return Response.json({ error: "Failed to fetch AI safety settings" }, { status: 500 });
  }
}

// PUT: update settings
export async function PUT(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updateData = {};

    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        const coerced = coerceValue(field, body[field]);
        if (coerced === null) {
          return Response.json(
            { error: `Invalid value for ${field}` },
            { status: 400 }
          );
        }
        if (coerced !== undefined) {
          updateData[field] = coerced;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from("accounts")
      .update(updateData)
      .eq("id", user.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: "AI safety settings saved",
      updated: updateData,
    });
  } catch (err) {
    console.error("AI safety settings PUT error:", err);
    return Response.json({ error: "Failed to save AI safety settings" }, { status: 500 });
  }
}
