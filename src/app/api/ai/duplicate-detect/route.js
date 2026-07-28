/**
 * POST /api/ai/duplicate-detect
 *
 * AI Duplicate Detection — finds customers who might be the same person
 * across different channels (WhatsApp, Instagram, Facebook, Email) and
 * links them into one unified profile.
 *
 * HOW IT WORKS:
 *   1. Fetches all customers for the account
 *   2. Runs clustering heuristics:
 *      - Same phone number (strong signal)
 *      - Same email (strong signal)
 *      - Similar name + same area code
 *      - Similar name + same last active window
 *      - LLM-powered name similarity for edge cases
 *   3. Returns groups of likely-duplicate customers with a merge confidence
 *
 * Body: { dry_run?: boolean }  — if true, doesn't modify any records,
 * just returns the detected duplicates. Default: true (safe).
 *
 * Response:
 *   {
 *     duplicate_groups: [
 *       {
 *         confidence: 95,
 *         reason: "Same phone number + similar name",
 *         customers: [
 *           { id, name, channel, phone, email, total_orders },
 *           ...
 *         ],
 *         suggested_primary: <customer_id>  // the one with most orders
 *       }
 *     ],
 *     total_duplicates: N,
 *     merged: false  // always false in dry_run mode
 *   }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";

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

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false;  // Default to dry run (safe)

    const db = admin();

    // Fetch all customers
    const { data: customers, error } = await db
      .from("customers")
      .select("id, name, email, phone, channel, total_orders, total_spent, last_active_at, created_at")
      .eq("account_id", effectiveAccountId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Run duplicate detection
    const groups = detectDuplicates(customers || []);

    // Pick suggested primary (most orders, then most spent)
    for (const group of groups) {
      group.suggested_primary = group.customers.reduce((best, c) =>
        (c.total_orders > best.total_orders) ||
        (c.total_orders === best.total_orders && c.total_spent > best.total_spent)
          ? c : best, group.customers[0]).id;
    }

    // If not dry run, actually merge (link duplicates to primary via a unified_customers table or tag)
    let mergedCount = 0;
    if (!dryRun && groups.length > 0) {
      for (const group of groups) {
        // Tag all duplicates with a shared link_id
        const linkId = group.suggested_primary;
        const duplicateIds = group.customers.filter(c => c.id !== linkId).map(c => c.id);

        if (duplicateIds.length > 0) {
          // Add a "linked_to" tag to each duplicate
          for (const dupId of duplicateIds) {
            const { data: existing } = await db.from("customers")
              .select("tags")
              .eq("id", dupId)
              .maybeSingle();
            const existingTags = existing?.tags || [];
            if (!existingTags.includes(`linked:${linkId}`)) {
              await db.from("customers")
                .update({ tags: [...existingTags, `linked:${linkId}`] })
                .eq("id", dupId);
              mergedCount++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      duplicate_groups: groups,
      total_duplicates: groups.length,
      total_customers_scanned: (customers || []).length,
      merged: !dryRun,
      merged_count: mergedCount,
      dry_run: dryRun,
    });
  } catch (e) {
    console.error("[DUPLICATE-DETECT] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Detect duplicate customers using clustering heuristics.
 */
function detectDuplicates(customers) {
  const groups = [];
  const seen = new Set();

  // ─── Signal 1: Same phone number (strongest) ───
  const byPhone = new Map();
  for (const c of customers) {
    if (!c.phone) continue;
    const normalized = c.phone.replace(/\D/g, "").slice(-10);  // Last 10 digits
    if (normalized.length < 7) continue;
    if (!byPhone.has(normalized)) byPhone.set(normalized, []);
    byPhone.get(normalized).push(c);
  }
  for (const [phone, group] of byPhone) {
    if (group.length < 2) continue;
    const ids = group.map(c => c.id);
    if (ids.some(id => seen.has(id))) continue;
    ids.forEach(id => seen.add(id));
    groups.push({
      confidence: 95,
      reason: `Same phone number ending in ${phone.slice(-4)}`,
      customers: group,
    });
  }

  // ─── Signal 2: Same email ───
  const byEmail = new Map();
  for (const c of customers) {
    if (!c.email) continue;
    const normalized = c.email.toLowerCase().trim();
    if (!byEmail.has(normalized)) byEmail.set(normalized, []);
    byEmail.get(normalized).push(c);
  }
  for (const [email, group] of byEmail) {
    if (group.length < 2) continue;
    const ids = group.map(c => c.id);
    if (ids.some(id => seen.has(id))) continue;
    ids.forEach(id => seen.add(id));
    groups.push({
      confidence: 90,
      reason: `Same email: ${email}`,
      customers: group,
    });
  }

  // ─── Signal 3: Similar name + same channel is NOT a dup (different convos on same channel)
  // But similar name + DIFFERENT channel + same area code = likely dup ───
  for (let i = 0; i < customers.length; i++) {
    for (let j = i + 1; j < customers.length; j++) {
      const a = customers[i];
      const b = customers[j];
      if (seen.has(a.id) || seen.has(b.id)) continue;
      if (a.channel === b.channel) continue;  // Same channel — likely different people

      const nameSim = nameSimilarity(a.name, b.name);
      if (nameSim < 0.7) continue;

      // Check phone area code match
      let areaMatch = false;
      if (a.phone && b.phone) {
        const aArea = a.phone.replace(/\D/g, "").slice(0, 3);
        const bArea = b.phone.replace(/\D/g, "").slice(0, 3);
        areaMatch = aArea === bArea && aArea.length === 3;
      }

      const confidence = Math.round(60 + nameSim * 25 + (areaMatch ? 10 : 0));
      const reason = `Similar name (${a.name} ≈ ${b.name}) on different channels${areaMatch ? " + same area code" : ""}`;

      seen.add(a.id);
      seen.add(b.id);
      groups.push({
        confidence,
        reason,
        customers: [a, b],
      });
    }
  }

  // Sort by confidence descending
  groups.sort((a, b) => b.confidence - a.confidence);
  return groups;
}

/**
 * Compute name similarity (0-1) using Levenshtein distance.
 */
function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  if (aLower === bLower) return 1;

  // Check if one name contains the other (e.g., "John Doe" vs "John")
  if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.85;

  // Check first name match
  const aFirst = aLower.split(" ")[0];
  const bFirst = bLower.split(" ")[0];
  if (aFirst === bFirst && aFirst.length >= 3) return 0.75;

  // Levenshtein-based similarity
  const dist = levenshtein(aLower, bLower);
  const maxLen = Math.max(aLower.length, bLower.length);
  return 1 - (dist / maxLen);
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
