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
 * POST /api/admin/create-admin
 *
 * Creates a brand new admin account, migrates ALL data from an old account,
 * and disconnects the old accounts from Meta platforms.
 *
 * Body: {
 *   email: string,
 *   password: string,
 *   businessName: string,
 *   ownerName: string,
 *   migrateFromAccountId: string,  // optional: old account to migrate data from
 *   disconnectOldAccount: boolean   // optional: disconnect old account from Meta (default: true)
 * }
 */
export async function POST(request) {
  try {
    // SECURITY: Require admin authentication
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const {
      email,
      password,
      businessName = "Sellora",
      ownerName = "",
      migrateFromAccountId,
      disconnectOldAccount = true,
    } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing required fields: email and password" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const results = { steps: [], warnings: [] };

    // ═══ Step 1: Create the new Supabase Auth user ═══
    console.log(`[CREATE-ADMIN] Creating new admin user: ${email}`);
    const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: ownerName,
      },
    });

    if (createError) {
      // Check if user already exists
      if (createError.message?.includes("already registered") || createError.code === "user_already_exists") {
        // Try to get the existing user
        const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
        if (!listError && existingUsers) {
          const existingUser = existingUsers.users.find(u => u.email === email);
          if (existingUser) {
            results.warnings.push(`User ${email} already exists in Auth. Will use existing user.`);
            results.steps.push({ step: "create_user", status: "exists", userId: existingUser.id });

            // Check if this user already has an account record
            const { data: existingAccount } = await supabase
              .from("accounts")
              .select("id, email, role, business_name")
              .eq("id", existingUser.id)
              .single();

            if (existingAccount) {
              // Update the existing account to be admin
              const { error: updateErr } = await supabase
                .from("accounts")
                .update({
                  role: "admin",
                  business_name: businessName,
                  owner_name: ownerName,
                  plan: "professional",
                  plan_status: "active",
                })
                .eq("id", existingUser.id);

              if (updateErr) {
                results.warnings.push(`Could not update existing account: ${updateErr.message}`);
              } else {
                results.steps.push({ step: "update_account", status: "updated", accountId: existingUser.id });
              }

              // Migrate data if requested
              if (migrateFromAccountId && migrateFromAccountId !== existingUser.id) {
                await migrateData(supabase, migrateFromAccountId, existingUser.id, results);
              }

              // Disconnect old account if requested
              if (disconnectOldAccount && migrateFromAccountId) {
                await disconnectOldAccounts(supabase, migrateFromAccountId, existingUser.id, results);
              }

              return NextResponse.json({
                success: true,
                message: `Account ${email} already existed. Updated to admin role and migrated data.`,
                userId: existingUser.id,
                results,
              });
            }

            // No account record yet - create one
            await createAccountRecord(supabase, existingUser.id, email, businessName, ownerName, results);

            // Migrate data if requested
            if (migrateFromAccountId && migrateFromAccountId !== existingUser.id) {
              await migrateData(supabase, migrateFromAccountId, existingUser.id, results);
            }

            // Disconnect old account if requested
            if (disconnectOldAccount && migrateFromAccountId) {
              await disconnectOldAccounts(supabase, migrateFromAccountId, existingUser.id, results);
            }

            return NextResponse.json({
              success: true,
              message: `Account ${email} already existed in Auth. Created account record as admin.`,
              userId: existingUser.id,
              results,
            });
          }
        }
      }

      console.error("[CREATE-ADMIN] Failed to create user:", createError.message);
      return NextResponse.json(
        { error: `Failed to create user: ${createError.message}` },
        { status: 500 }
      );
    }

    const newUserId = newUserData.user.id;
    results.steps.push({ step: "create_user", status: "created", userId: newUserId });
    console.log(`[CREATE-ADMIN] Created user: ${newUserId}`);

    // ═══ Step 2: Create the account record ═══
    await createAccountRecord(supabase, newUserId, email, businessName, ownerName, results);

    // ═══ Step 3: Migrate data from old account ═══
    if (migrateFromAccountId && migrateFromAccountId !== newUserId) {
      await migrateData(supabase, migrateFromAccountId, newUserId, results);
    }

    // ═══ Step 4: Disconnect old accounts from Meta ═══
    if (disconnectOldAccount && migrateFromAccountId) {
      await disconnectOldAccounts(supabase, migrateFromAccountId, newUserId, results);
    }

    return NextResponse.json({
      success: true,
      message: `New admin account created: ${email}`,
      userId: newUserId,
      results,
    });
  } catch (error) {
    console.error("[CREATE-ADMIN] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Create the accounts table record with admin role
 */
async function createAccountRecord(supabase, userId, email, businessName, ownerName, results) {
  console.log(`[CREATE-ADMIN] Creating account record for: ${email}`);
  const { error: accountError } = await supabase.from("accounts").insert({
    id: userId,
    email,
    business_name: businessName,
    owner_name: ownerName,
    role: "admin",
    plan: "professional",
    plan_status: "active",
    onboarding_completed: true,
    ai_enabled: true,
    ai_personality: "Friendly, professional, and helpful. Use emojis sparingly.",
    ai_languages: ["en", "ar"],
  });

  if (accountError) {
    console.error("[CREATE-ADMIN] Failed to create account:", accountError.message);
    results.warnings.push(`Account record creation failed: ${accountError.message}`);
    results.steps.push({ step: "create_account", status: "error", error: accountError.message });
  } else {
    results.steps.push({ step: "create_account", status: "created", accountId: userId });
  }
}

/**
 * Migrate all data from the old account to the new one
 */
async function migrateData(supabase, fromId, toId, results) {
  console.log(`[CREATE-ADMIN] Migrating data from ${fromId} → ${toId}`);

  // 1. Migrate Meta connections (page_ids, tokens, flags)
  const { data: sourceAccount } = await supabase
    .from("accounts")
    .select("facebook_page_id, facebook_access_token, facebook_connected, instagram_page_id, instagram_access_token, instagram_connected, instagram_url, facebook_url, ai_personality, ai_languages, ai_enabled, auto_greeting, auto_greeting_message")
    .eq("id", fromId)
    .single();

  if (sourceAccount) {
    const metaUpdates = {};
    if (sourceAccount.facebook_page_id) metaUpdates.facebook_page_id = sourceAccount.facebook_page_id;
    if (sourceAccount.facebook_access_token) metaUpdates.facebook_access_token = sourceAccount.facebook_access_token;
    if (sourceAccount.facebook_connected) metaUpdates.facebook_connected = sourceAccount.facebook_connected;
    if (sourceAccount.instagram_page_id) metaUpdates.instagram_page_id = sourceAccount.instagram_page_id;
    if (sourceAccount.instagram_access_token) metaUpdates.instagram_access_token = sourceAccount.instagram_access_token;
    if (sourceAccount.instagram_connected) metaUpdates.instagram_connected = sourceAccount.instagram_connected;
    if (sourceAccount.instagram_url) metaUpdates.instagram_url = sourceAccount.instagram_url;
    if (sourceAccount.facebook_url) metaUpdates.facebook_url = sourceAccount.facebook_url;
    if (sourceAccount.ai_personality) metaUpdates.ai_personality = sourceAccount.ai_personality;
    if (sourceAccount.ai_languages) metaUpdates.ai_languages = sourceAccount.ai_languages;
    if (sourceAccount.ai_enabled !== undefined) metaUpdates.ai_enabled = sourceAccount.ai_enabled;
    if (sourceAccount.auto_greeting) metaUpdates.auto_greeting = sourceAccount.auto_greeting;
    if (sourceAccount.auto_greeting_message) metaUpdates.auto_greeting_message = sourceAccount.auto_greeting_message;

    if (Object.keys(metaUpdates).length > 0) {
      const { error: metaErr } = await supabase
        .from("accounts")
        .update(metaUpdates)
        .eq("id", toId);

      if (metaErr) {
        results.warnings.push(`Meta connection migration failed: ${metaErr.message}`);
        results.steps.push({ step: "migrate_meta", status: "error", error: metaErr.message });
      } else {
        results.steps.push({
          step: "migrate_meta",
          status: "migrated",
          details: Object.keys(metaUpdates).join(", "),
        });
      }
    }
  }

  // 2. Migrate conversations
  const { count: convCount } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("account_id", fromId);
  if (convCount && convCount > 0) {
    const { error: convErr } = await supabase
      .from("conversations")
      .update({ account_id: toId })
      .eq("account_id", fromId);
    results.steps.push({
      step: "migrate_conversations",
      status: convErr ? "error" : "migrated",
      count: convCount,
      ...(convErr ? { error: convErr.message } : {}),
    });
  }

  // 3. Migrate messages
  const { count: msgCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("account_id", fromId);
  if (msgCount && msgCount > 0) {
    const { error: msgErr } = await supabase
      .from("messages")
      .update({ account_id: toId })
      .eq("account_id", fromId);
    results.steps.push({
      step: "migrate_messages",
      status: msgErr ? "error" : "migrated",
      count: msgCount,
      ...(msgErr ? { error: msgErr.message } : {}),
    });
  }

  // 4. Migrate customers (with dedup)
  const { data: sourceCustomers } = await supabase
    .from("customers")
    .select("*")
    .eq("account_id", fromId);
  if (sourceCustomers && sourceCustomers.length > 0) {
    let migrated = 0, skipped = 0;
    for (const cust of sourceCustomers) {
      if (cust.platform_id) {
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("account_id", toId)
          .eq("platform_id", cust.platform_id)
          .maybeSingle();
        if (existing) {
          // Re-link conversations/messages, then delete duplicate
          await supabase.from("conversations").update({ customer_id: existing.id }).eq("customer_id", cust.id);
          await supabase.from("customers").delete().eq("id", cust.id);
          skipped++;
          continue;
        }
      }
      await supabase.from("customers").update({ account_id: toId }).eq("id", cust.id);
      migrated++;
    }
    results.steps.push({ step: "migrate_customers", status: "migrated", migrated, skipped });
  }

  // 5. Migrate products
  const { count: prodCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("account_id", fromId);
  if (prodCount && prodCount > 0) {
    await supabase.from("products").update({ account_id: toId }).eq("account_id", fromId);
    results.steps.push({ step: "migrate_products", status: "migrated", count: prodCount });
  }

  // 6. Migrate orders
  const { count: ordCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("account_id", fromId);
  if (ordCount && ordCount > 0) {
    await supabase.from("orders").update({ account_id: toId }).eq("account_id", fromId);
    results.steps.push({ step: "migrate_orders", status: "migrated", count: ordCount });
  }

  // 7. Migrate FAQs
  const { count: faqCount } = await supabase
    .from("faqs")
    .select("*", { count: "exact", head: true })
    .eq("account_id", fromId);
  if (faqCount && faqCount > 0) {
    await supabase.from("faqs").update({ account_id: toId }).eq("account_id", fromId);
    results.steps.push({ step: "migrate_faqs", status: "migrated", count: faqCount });
  }

  // 8. Migrate quick_replies
  const { count: qrCount } = await supabase
    .from("quick_replies")
    .select("*", { count: "exact", head: true })
    .eq("account_id", fromId);
  if (qrCount && qrCount > 0) {
    await supabase.from("quick_replies").update({ account_id: toId }).eq("account_id", fromId);
    results.steps.push({ step: "migrate_quick_replies", status: "migrated", count: qrCount });
  }

  // 9. Migrate auto_replies
  const { count: arCount } = await supabase
    .from("auto_replies")
    .select("*", { count: "exact", head: true })
    .eq("account_id", fromId);
  if (arCount && arCount > 0) {
    await supabase.from("auto_replies").update({ account_id: toId }).eq("account_id", fromId);
    results.steps.push({ step: "migrate_auto_replies", status: "migrated", count: arCount });
  }

  // 10. Migrate campaigns
  const { count: campCount } = await supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .eq("account_id", fromId);
  if (campCount && campCount > 0) {
    await supabase.from("campaigns").update({ account_id: toId }).eq("account_id", fromId);
    results.steps.push({ step: "migrate_campaigns", status: "migrated", count: campCount });
  }

  // 11. Migrate agent_actions
  const { count: aaCount } = await supabase
    .from("agent_actions")
    .select("*", { count: "exact", head: true })
    .eq("account_id", fromId);
  if (aaCount && aaCount > 0) {
    await supabase.from("agent_actions").update({ account_id: toId }).eq("account_id", fromId);
    results.steps.push({ step: "migrate_agent_actions", status: "migrated", count: aaCount });
  }

  console.log(`[CREATE-ADMIN] Migration complete: ${results.steps.filter(s => s.status === "migrated").length} tables migrated`);
}

/**
 * Disconnect old accounts from Meta platforms and clean up
 */
async function disconnectOldAccounts(supabase, oldAccountId, newAccountId, results) {
  console.log(`[CREATE-ADMIN] Disconnecting old account: ${oldAccountId}`);

  // Clear Meta connections from the old account
  const { error: clearErr } = await supabase
    .from("accounts")
    .update({
      facebook_page_id: null,
      facebook_access_token: null,
      facebook_connected: false,
      instagram_page_id: null,
      instagram_access_token: null,
      instagram_connected: false,
    })
    .eq("id", oldAccountId);

  if (clearErr) {
    results.warnings.push(`Failed to disconnect old account: ${clearErr.message}`);
    results.steps.push({ step: "disconnect_old", status: "error", error: clearErr.message });
  } else {
    results.steps.push({ step: "disconnect_old", status: "disconnected", accountId: oldAccountId });
  }

  // Also disconnect ALL other accounts that might share the page_id
  // Get the new account's page_ids
  const { data: newAccount } = await supabase
    .from("accounts")
    .select("facebook_page_id, instagram_page_id")
    .eq("id", newAccountId)
    .single();

  if (newAccount) {
    const pageIds = [newAccount.facebook_page_id, newAccount.instagram_page_id].filter(Boolean);

    for (const pageId of pageIds) {
      // Find any other accounts with the same page_id
      const { data: otherAccounts } = await supabase
        .from("accounts")
        .select("id, email, business_name")
        .or(`facebook_page_id.eq.${pageId},instagram_page_id.eq.${pageId}`)
        .neq("id", newAccountId);

      if (otherAccounts && otherAccounts.length > 0) {
        for (const other of otherAccounts) {
          console.log(`[CREATE-ADMIN] Also disconnecting: ${other.email}`);
          await supabase
            .from("accounts")
            .update({
              facebook_page_id: null,
              facebook_access_token: null,
              facebook_connected: false,
              instagram_page_id: null,
              instagram_access_token: null,
              instagram_connected: false,
            })
            .eq("id", other.id);
        }
        results.steps.push({
          step: "disconnect_other_duplicates",
          status: "disconnected",
          accounts: otherAccounts.map(a => a.email),
        });
      }
    }
  }

  // Remove team_member entries for old account
  try { await supabase.from("team_members").delete().eq("user_id", oldAccountId); } catch (e) { /* ok */ }
  try { await supabase.from("team_members").delete().eq("account_id", oldAccountId); } catch (e) { /* ok */ }
}
