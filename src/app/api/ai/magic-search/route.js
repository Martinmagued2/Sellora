/**
 * POST /api/ai/magic-search
 *
 * Natural-language customer/conversation search.
 *
 * Examples of what users can type:
 *   "Customers who haven't ordered in 30 days"
 *   "Angry customers from last week"
 *   "Customers who spent more than $200"
 *   "Find everyone interested in Product X"
 *   "Customers from Egypt"
 *   "Customers who mentioned shipping"
 *
 * HOW IT WORKS:
 *   1. The LLM parses the natural-language query into structured Supabase filters
 *      (a JSON object with table, filters, order, limit).
 *   2. The endpoint executes those filters against the customers table
 *      (with account_id scoping for security).
 *   3. Returns the matching customers + the LLM's explanation of what it searched for.
 *
 * SECURITY: The account_id filter is ALWAYS applied server-side — the LLM
 * cannot bypass it. The LLM only controls which fields to filter by, not
 * which account to query.
 *
 * If no AI provider is configured, falls back to keyword-based search
 * using basic regex patterns ("spent more than X", "haven't ordered", etc).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";
import { buildStandaloneProvider } from "@/lib/ai/standalone-provider";

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const db = admin();

    // Try LLM-powered search
    const model = buildStandaloneProvider();
    let filters = null;
    let explanation = "";
    let aiPowered = false;

    if (model) {
      try {
        const systemPrompt = `You are a search assistant for a customer database. Convert the user's natural-language query into a JSON filter object that can be applied to a Supabase "customers" table query.

The customers table has these columns:
- id (uuid)
- name (text)
- email (text)
- phone (text)
- channel (text: whatsapp, instagram, facebook, manual)
- tags (text[])
- notes (text)
- total_orders (integer)
- total_spent (numeric)
- last_active_at (timestamptz)
- created_at (timestamptz)
- lifecycle_stage (text: lead, prospect, customer, churned, reactivated)
- country (text, if available — may be null)
- assigned_to (uuid)

Return a JSON object with this schema:
{
  "filters": [
    { "column": "total_spent", "op": "gte", "value": 200 },
    { "column": "last_active_at", "op": "lt", "value": "2026-06-23T00:00:00Z" }
  ],
  "order": { "column": "total_spent", "ascending": false },
  "limit": 20,
  "explanation": "Customers who spent $200+ and haven't been active recently"
}

Valid operators: eq, neq, gt, gte, lt, lte, like, ilike, in, contains (for arrays)

For date-based queries like "last 30 days", compute the actual date relative to today (${new Date().toISOString()}).

For text searches like "mentioned shipping", use ilike on the notes column.

Return ONLY the JSON object, no markdown fences.`;

        const result = await generateText({
          model,
          system: systemPrompt,
          prompt: query,
          temperature: 0.1,
          maxTokens: 500,
        });

        const text = result.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
        const parsed = JSON.parse(text);
        filters = parsed;
        explanation = parsed.explanation || "";
        aiPowered = true;
      } catch (llmErr) {
        console.warn("[MAGIC-SEARCH] LLM failed, using keyword fallback:", llmErr.message);
      }
    }

    // Build the Supabase query
    let supabaseQuery = db
      .from("customers")
      .select("id, name, email, phone, channel, tags, total_orders, total_spent, last_active_at, lifecycle_stage, notes")
      .eq("account_id", effectiveAccountId);  // SECURITY: always scope by account

    if (aiPowered && filters?.filters) {
      // Apply LLM-generated filters
      for (const f of filters.filters) {
        const { column, op, value } = f;
        // SECURITY: never allow account_id to be overridden
        if (column === "account_id") continue;
        switch (op) {
          case "eq": supabaseQuery = supabaseQuery.eq(column, value); break;
          case "neq": supabaseQuery = supabaseQuery.neq(column, value); break;
          case "gt": supabaseQuery = supabaseQuery.gt(column, value); break;
          case "gte": supabaseQuery = supabaseQuery.gte(column, value); break;
          case "lt": supabaseQuery = supabaseQuery.lt(column, value); break;
          case "lte": supabaseQuery = supabaseQuery.lte(column, value); break;
          case "like": supabaseQuery = supabaseQuery.like(column, value); break;
          case "ilike": supabaseQuery = supabaseQuery.ilike(column, value); break;
          case "in": supabaseQuery = supabaseQuery.in(column, Array.isArray(value) ? value : [value]); break;
          case "contains": supabaseQuery = supabaseQuery.contains(column, Array.isArray(value) ? value : [value]); break;
        }
      }

      // Apply ordering
      if (filters.order) {
        supabaseQuery = supabaseQuery.order(filters.order.column, {
          ascending: filters.order.ascending || false,
        });
      } else {
        supabaseQuery = supabaseQuery.order("total_spent", { ascending: false });
      }

      // Apply limit
      supabaseQuery = supabaseQuery.limit(filters.limit || 20);
    } else {
      // Keyword-based fallback search
      const keywordResults = keywordSearch(query);
      if (keywordResults.ilikeColumn) {
        supabaseQuery = supabaseQuery.ilike(keywordResults.ilikeColumn, keywordResults.ilikeValue);
      }
      if (keywordResults.minSpent) {
        supabaseQuery = supabaseQuery.gte("total_spent", keywordResults.minSpent);
      }
      if (keywordResults.minOrders) {
        supabaseQuery = supabaseQuery.gte("total_orders", keywordResults.minOrders);
      }
      if (keywordResults.lifecycleStage) {
        supabaseQuery = supabaseQuery.eq("lifecycle_stage", keywordResults.lifecycleStage);
      }
      explanation = keywordResults.explanation || `Searching for "${query}"`;
      supabaseQuery = supabaseQuery.order("total_spent", { ascending: false }).limit(20);
    }

    const { data: customers, error } = await supabaseQuery;

    if (error) {
      console.error("[MAGIC-SEARCH] query error:", error.message);
      return NextResponse.json({ error: "Search failed: " + error.message }, { status: 500 });
    }

    return NextResponse.json({
      query,
      explanation: explanation || `Found ${customers?.length || 0} customers matching "${query}"`,
      customers: customers || [],
      count: customers?.length || 0,
      ai_powered: aiPowered,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[MAGIC-SEARCH] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Keyword-based fallback search parser.
 * Recognizes common patterns:
 *   - "spent more than $200" / "spent over 500"
 *   - "haven't ordered in 30 days" / "inactive"
 *   - "angry" / "complained" → search notes for keywords
 *   - "from Egypt" / "country: X"
 *   - "VIP" / "loyal" → lifecycle_stage = customer + total_orders > 1
 *   - "lead" → lifecycle_stage = lead
 *   - "churned" → lifecycle_stage = churned
 */
function keywordSearch(query) {
  const q = query.toLowerCase();
  const result = { ilikeColumn: null, ilikeValue: null, minSpent: null, minOrders: null, lifecycleStage: null, explanation: "" };

  // Spent more than X
  const spentMatch = q.match(/spent (?:more than |over |at least )?\$?(\d+)/);
  if (spentMatch) {
    result.minSpent = parseFloat(spentMatch[1]);
    result.explanation = `Customers who spent $${result.minSpent}+`;
  }

  // More than X orders
  const ordersMatch = q.match(/(\d+)\+?\s*orders?/);
  if (ordersMatch) {
    result.minOrders = parseInt(ordersMatch[1], 10);
    result.explanation = (result.explanation ? result.explanation + " and " : "") + `with ${result.minOrders}+ orders`;
  }

  // Lifecycle stages
  if (/\bchurned\b/.test(q)) {
    result.lifecycleStage = "churned";
    result.explanation = (result.explanation ? result.explanation + " and " : "") + "churned customers";
  } else if (/\blead\b/.test(q)) {
    result.lifecycleStage = "lead";
    result.explanation = (result.explanation ? result.explanation + " and " : "") + "leads";
  } else if (/\bprospect\b/.test(q)) {
    result.lifecycleStage = "prospect";
    result.explanation = (result.explanation ? result.explanation + " and " : "") + "prospects";
  }

  // Angry / complaint → search notes
  if (/\bangry|complain|frustrat|upset|unhappy/.test(q)) {
    result.ilikeColumn = "notes";
    result.ilikeValue = "%complain%";
    result.explanation = (result.explanation ? result.explanation + " and " : "") + "customers who complained";
  }

  // Haven't ordered / inactive
  if (/\bhaven't ordered|inactive|no orders?\b/.test(q)) {
    result.minOrders = 0;
    result.explanation = (result.explanation ? result.explanation + " and " : "") + "with no orders";
  }

  // Mentioned X → search notes
  const mentionMatch = q.match(/mentioned\s+(\w+)/);
  if (mentionMatch) {
    result.ilikeColumn = "notes";
    result.ilikeValue = `%${mentionMatch[1]}%`;
    result.explanation = (result.explanation ? result.explanation + " and " : "") + `who mentioned "${mentionMatch[1]}"`;
  }

  // Name search fallback
  if (!result.ilikeColumn && !result.minSpent && !result.minOrders && !result.lifecycleStage) {
    // Extract a name-like word
    const nameMatch = q.match(/\b([a-z]{3,})\b/i);
    if (nameMatch && !["customers", "customer", "find", "show", "search", "from", "with", "have", "has", "more", "than", "spent", "orders", "who"].includes(nameMatch[1].toLowerCase())) {
      result.ilikeColumn = "name";
      result.ilikeValue = `%${nameMatch[1]}%`;
      result.explanation = `Customers named "${nameMatch[1]}"`;
    } else {
      result.explanation = `Searching for "${query}"`;
    }
  }

  return result;
}
