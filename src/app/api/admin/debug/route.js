import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/admin-auth";

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

/**
 * GET /api/admin/debug
 *
 * Comprehensive diagnostic endpoint to investigate account connections.
 * Query params:
 *   - email: Filter by email (partial match)
 *   - action: "diagnose" (default) | "fix" (auto-fix issues)
 *
 * Shows: full account state, team_member links, shared page_ids, stale flags
 */
export async function GET(request) {
  try {
    // SECURITY: Require admin authentication
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const url = new URL(request.url);
    const emailFilter = url.searchParams.get("email") || "";
    const action = url.searchParams.get("action") || "diagnose";

    const supabase = getSupabase();
    const results = {
      timestamp: new Date().toISOString(),
      action,
      accounts: [],
      teamLinks: [],
      sharedPageIds: [],
      staleConnections: [],
      fixes: [],
    };

    // ═══ 1. Fetch all accounts with Meta connection data ═══
    let query = supabase
      .from("accounts")
      .select(`
        id, email, business_name, role, plan, plan_status,
        facebook_page_id, facebook_connected,
        instagram_page_id, instagram_connected,
        whatsapp_connected, whatsapp_phone_number_id,
        created_at, updated_at
      `);

    if (emailFilter) {
      const sanitizedEmail = emailFilter.replace(/[%)_(,.]/g, '\\$&');
      query = query.ilike("email", `%${sanitizedEmail}%`);
    }

    const { data: accounts, error: acctErr } = await query;

    if (acctErr) {
      return NextResponse.json({ error: acctErr.message }, { status: 500 });
    }

    results.accounts = accounts || [];

    // ═══ 2. Check for team_members links between accounts ═══
    const accountIds = (accounts || []).map(a => a.id);

    if (accountIds.length > 0) {
      const { data: teamMembers, error: teamErr } = await supabase
        .from("team_members")
        .select("id, account_id, user_id, role, invited_email, invite_status")
        .or(accountIds.map(id => `account_id.eq.${id}`).join(","));

      if (!teamErr && teamMembers) {
        results.teamLinks = teamMembers;

        // Enrich team links with account info
        for (const tm of results.teamLinks) {
          const owner = accounts?.find(a => a.id === tm.account_id);
          const member = accounts?.find(a => a.id === tm.user_id);
          tm.owner_email = owner?.email || "unknown";
          tm.member_email = member?.email || tm.invited_email || "external user";
        }
      }
    }

    // ═══ 3. Detect shared page_ids ═══
    const fbPageMap = {};
    const igPageMap = {};

    for (const acct of accounts || []) {
      if (acct.facebook_page_id) {
        if (!fbPageMap[acct.facebook_page_id]) fbPageMap[acct.facebook_page_id] = [];
        fbPageMap[acct.facebook_page_id].push({
          id: acct.id,
          email: acct.email,
          has_token: !!acct.facebook_page_id,
          connected: acct.facebook_connected,
        });
      }
      if (acct.instagram_page_id) {
        if (!igPageMap[acct.instagram_page_id]) igPageMap[acct.instagram_page_id] = [];
        igPageMap[acct.instagram_page_id].push({
          id: acct.id,
          email: acct.email,
          has_token: !!acct.instagram_page_id,
          connected: acct.instagram_connected,
        });
      }
    }

    for (const [pageId, accts] of Object.entries(fbPageMap)) {
      if (accts.length > 1) {
        results.sharedPageIds.push({
          type: "facebook",
          page_id: pageId,
          accounts: accts,
          severity: "critical",
          message: `${accts.length} accounts share facebook_page_id ${pageId}. This will cause webhook routing issues.`,
        });
      }
    }

    for (const [pageId, accts] of Object.entries(igPageMap)) {
      if (accts.length > 1) {
        results.sharedPageIds.push({
          type: "instagram",
          page_id: pageId,
          accounts: accts,
          severity: "critical",
          message: `${accts.length} accounts share instagram_page_id ${pageId}. This will cause webhook routing issues.`,
        });
      }
    }

    // ═══ 4. Detect stale connected flags ═══
    for (const acct of accounts || []) {
      const issues = [];

      if (acct.facebook_connected && !acct.facebook_page_id) {
        issues.push({
          field: "facebook_connected",
          value: acct.facebook_connected,
          reason: `facebook_connected is true but facebook_page_id is null`,
        });
      }

      if (acct.instagram_connected && !acct.instagram_page_id) {
        issues.push({
          field: "instagram_connected",
          value: acct.instagram_connected,
          reason: `instagram_connected is true but instagram_page_id is null`,
        });
      }

      // Check if facebook_page_id matches instagram_page_id (they SHOULD match for Meta)
      if (acct.facebook_page_id && acct.instagram_page_id &&
          acct.facebook_page_id !== acct.instagram_page_id) {
        issues.push({
          field: "page_id_mismatch",
          value: { facebook: acct.facebook_page_id, instagram: acct.instagram_page_id },
          reason: "facebook_page_id and instagram_page_id should match (Instagram webhooks use the FB Page ID)",
        });
      }

      if (issues.length > 0) {
        results.staleConnections.push({
          account_id: acct.id,
          email: acct.email,
          business_name: acct.business_name,
          issues,
        });
      }
    }

    // ═══ 5. Auto-fix if action=fix ═══
    if (action === "fix") {
      // Fix 1: Clear duplicate page_ids (keep account with valid token)
      for (const shared of results.sharedPageIds) {
        const accts = shared.accounts;
        const keeper = accts.find(a => a.has_token) || accts[0];

        for (const acct of accts) {
          if (acct.id !== keeper.id) {
            const updateField = shared.type === "facebook"
              ? { facebook_page_id: null, facebook_access_token: null, facebook_connected: false }
              : { instagram_page_id: null, instagram_access_token: null, instagram_connected: false };

            const { error: fixErr } = await supabase
              .from("accounts")
              .update(updateField)
              .eq("id", acct.id);

            if (fixErr) {
              results.fixes.push({
                type: "duplicate_page_id",
                account: acct.email,
                status: "error",
                error: fixErr.message,
              });
            } else {
              results.fixes.push({
                type: "duplicate_page_id",
                account: acct.email,
                status: "fixed",
                detail: `Cleared ${shared.type} page_id ${shared.page_id} from ${acct.email} (kept on ${keeper.email})`,
              });
            }
          }
        }
      }

      // Fix 2: Clear stale connected flags
      for (const stale of results.staleConnections) {
        const updates = {};

        for (const issue of stale.issues) {
          if (issue.field === "facebook_connected") {
            updates.facebook_connected = false;
            if (!stale.issues.find(i => i.field === "page_id_mismatch")) {
              // Don't clear page_id if it's a mismatch issue, only if stale
            }
          }
          if (issue.field === "instagram_connected") {
            updates.instagram_connected = false;
          }
        }

        if (Object.keys(updates).length > 0) {
          const { error: fixErr } = await supabase
            .from("accounts")
            .update(updates)
            .eq("id", stale.account_id);

          if (fixErr) {
            results.fixes.push({
              type: "stale_flags",
              account: stale.email,
              status: "error",
              error: fixErr.message,
            });
          } else {
            results.fixes.push({
              type: "stale_flags",
              account: stale.email,
              status: "fixed",
              detail: `Cleared stale flags: ${Object.keys(updates).join(", ")}`,
            });
          }
        }
      }

      // Fix 3: Remove team_member links between accounts that share page_ids
      for (const shared of results.sharedPageIds) {
        const nonKeeperIds = shared.accounts.filter(a => a.id !== (shared.accounts.find(a => a.has_token) || shared.accounts[0]).id);

        for (const nonKeeper of nonKeeperIds) {
          // Remove team_member entries where this account is a member
          const { error: delErr } = await supabase
            .from("team_members")
            .delete()
            .eq("user_id", nonKeeper.id);

          if (!delErr) {
            results.fixes.push({
              type: "team_link_removed",
              account: nonKeeper.email,
              status: "fixed",
              detail: `Removed team_member links for ${nonKeeper.email}`,
            });
          }
        }
      }
    }

    // ═══ Summary ═══
    results.summary = {
      total_accounts: results.accounts.length,
      shared_page_ids_count: results.sharedPageIds.length,
      stale_connections_count: results.staleConnections.length,
      team_links_count: results.teamLinks.length,
      has_issues: results.sharedPageIds.length > 0 || results.staleConnections.length > 0,
      fix_applied: action === "fix",
      fixes_count: results.fixes.length,
    };

    return NextResponse.json(results);
  } catch (error) {
    console.error("[ADMIN-DEBUG] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/debug
 *
 * Force-disconnect a specific account from Meta platforms.
 * Body: { accountId: string, platforms: string[] }
 *   platforms: ["facebook", "instagram", "whatsapp", "all"]
 */
export async function POST(request) {
  try {
    // SECURITY: Require admin authentication
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { accountId, platforms } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify account exists
    const { data: account, error: acctErr } = await supabase
      .from("accounts")
      .select("id, email, business_name, facebook_page_id, instagram_page_id, facebook_connected, instagram_connected")
      .eq("id", accountId)
      .single();

    if (acctErr || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const targetPlatforms = platforms || ["all"];
    const disconnectAll = targetPlatforms.includes("all");
    const updates = {};
    const details = [];

    if (disconnectAll || targetPlatforms.includes("facebook")) {
      updates.facebook_page_id = null;
      updates.facebook_access_token = null;
      updates.facebook_connected = false;
      details.push("Facebook disconnected");
    }

    if (disconnectAll || targetPlatforms.includes("instagram")) {
      updates.instagram_page_id = null;
      updates.instagram_access_token = null;
      updates.instagram_connected = false;
      details.push("Instagram disconnected");
    }

    if (disconnectAll || targetPlatforms.includes("whatsapp")) {
      updates.whatsapp_phone_number_id = null;
      updates.whatsapp_access_token = null;
      updates.whatsapp_connected = false;
      details.push("WhatsApp disconnected");
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No platforms specified for disconnect" }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", accountId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Also remove team_member entries for this account
    const { error: teamDelErr1 } = await supabase
      .from("team_members")
      .delete()
      .eq("user_id", accountId);

    const { error: teamDelErr2 } = await supabase
      .from("team_members")
      .delete()
      .eq("account_id", accountId);

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        email: account.email,
        business_name: account.business_name,
      },
      disconnected: details,
      team_links_removed: !teamDelErr1 || !teamDelErr2,
    });
  } catch (error) {
    console.error("[ADMIN-DEBUG] POST Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
