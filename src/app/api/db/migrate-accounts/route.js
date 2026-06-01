import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Lazy-init admin client (bypasses RLS)
let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

/**
 * POST /api/db/migrate-accounts
 *
 * Migrate all orphaned data from one Supabase account to another.
 * Uses the SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 *
 * Body: { fromAccountId: string, toAccountId: string }
 *
 * Migrates: conversations, messages, customers (skip duplicates),
 *           products, orders, faqs, quick_replies, auto_replies,
 *           campaigns, rate_limits, agent_actions
 *
 * Also copies business_name from source to target if target has "My Store".
 *
 * Returns per-table counts of migrated records.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { fromAccountId, toAccountId } = body;

    // ── Validate input ──
    if (!fromAccountId || !toAccountId) {
      return NextResponse.json(
        { error: "Missing required fields: fromAccountId and toAccountId" },
        { status: 400 }
      );
    }

    if (fromAccountId === toAccountId) {
      return NextResponse.json(
        { error: "fromAccountId and toAccountId must be different" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // ── Verify both accounts exist ──
    const [sourceRes, targetRes] = await Promise.all([
      admin.from("accounts").select("id, business_name, email").eq("id", fromAccountId).single(),
      admin.from("accounts").select("id, business_name, email").eq("id", toAccountId).single(),
    ]);

    if (sourceRes.error) {
      return NextResponse.json(
        { error: `Source account not found: ${sourceRes.error.message}` },
        { status: 404 }
      );
    }
    if (targetRes.error) {
      return NextResponse.json(
        { error: `Target account not found: ${targetRes.error.message}` },
        { status: 404 }
      );
    }

    const sourceAccount = sourceRes.data;
    const targetAccount = targetRes.data;

    console.log(`[MIGRATE-ACCOUNTS] Starting migration from "${sourceAccount.email}" (${fromAccountId}) → "${targetAccount.email}" (${toAccountId})`);

    const counts = {};
    const errors = [];

    // ── Helper: update account_id on a table and return count ──
    async function migrateTable(tableName, opts = {}) {
      const { column = "account_id", filterCol = "account_id", filterVal = fromAccountId } = opts;
      try {
        // Count records before migration
        const { count: beforeCount, error: countErr } = await admin
          .from(tableName)
          .select("*", { count: "exact", head: true })
          .eq(filterCol, filterVal);

        if (countErr) {
          console.warn(`[MIGRATE-ACCOUNTS] Could not count ${tableName}: ${countErr.message}`);
          counts[tableName] = { migrated: 0, error: countErr.message };
          return;
        }

        if (!beforeCount || beforeCount === 0) {
          console.log(`[MIGRATE-ACCOUNTS] ${tableName}: no records to migrate`);
          counts[tableName] = { migrated: 0 };
          return;
        }

        // Perform the update
        const updateObj = { [column]: toAccountId };
        const { error: updateErr } = await admin
          .from(tableName)
          .update(updateObj)
          .eq(filterCol, filterVal);

        if (updateErr) {
          console.error(`[MIGRATE-ACCOUNTS] Error migrating ${tableName}: ${updateErr.message}`);
          errors.push({ table: tableName, error: updateErr.message });
          counts[tableName] = { migrated: 0, error: updateErr.message };
        } else {
          console.log(`[MIGRATE-ACCOUNTS] ${tableName}: migrated ${beforeCount} record(s)`);
          counts[tableName] = { migrated: beforeCount };
        }
      } catch (err) {
        console.error(`[MIGRATE-ACCOUNTS] Unexpected error on ${tableName}:`, err);
        errors.push({ table: tableName, error: err.message });
        counts[tableName] = { migrated: 0, error: err.message };
      }
    }

    // ═══════════════════════════════════════
    // 1. Conversations
    // ═══════════════════════════════════════
    await migrateTable("conversations");

    // ═══════════════════════════════════════
    // 2. Messages
    // ═══════════════════════════════════════
    await migrateTable("messages");

    // ═══════════════════════════════════════
    // 3. Customers (skip if same platform_id on target)
    // ═══════════════════════════════════════
    try {
      const { data: sourceCustomers, error: custFetchErr } = await admin
        .from("customers")
        .select("*")
        .eq("account_id", fromAccountId);

      if (custFetchErr) {
        console.error(`[MIGRATE-ACCOUNTS] Error fetching customers: ${custFetchErr.message}`);
        errors.push({ table: "customers", error: custFetchErr.message });
        counts.customers = { migrated: 0, skipped: 0, error: custFetchErr.message };
      } else if (!sourceCustomers || sourceCustomers.length === 0) {
        console.log(`[MIGRATE-ACCOUNTS] customers: no records to migrate`);
        counts.customers = { migrated: 0, skipped: 0 };
      } else {
        let migrated = 0;
        let skipped = 0;

        for (const cust of sourceCustomers) {
          // Check if a customer with the same platform_id already exists on the target account
          if (cust.platform_id) {
            const { data: existingCust, error: checkErr } = await admin
              .from("customers")
              .select("id")
              .eq("account_id", toAccountId)
              .eq("platform_id", cust.platform_id)
              .maybeSingle();

            if (checkErr) {
              console.warn(`[MIGRATE-ACCOUNTS] Error checking duplicate customer ${cust.id}: ${checkErr.message}`);
            }

            if (existingCust) {
              // Skip — re-link conversations/messages to the existing customer, then delete the duplicate
              console.log(`[MIGRATE-ACCOUNTS] Customer ${cust.platform_id} already exists on target (id: ${existingCust.id}), re-linking and removing duplicate`);

              // Re-link conversations from the old customer to the existing one
              const { error: convRelinkErr } = await admin
                .from("conversations")
                .update({ customer_id: existingCust.id })
                .eq("customer_id", cust.id);
              if (convRelinkErr) {
                console.warn(`[MIGRATE-ACCOUNTS] Conv re-link error for customer ${cust.id}: ${convRelinkErr.message}`);
              }

              // Re-link orders from the old customer to the existing one
              const { error: ordRelinkErr } = await admin
                .from("orders")
                .update({ customer_id: existingCust.id })
                .eq("customer_id", cust.id);
              if (ordRelinkErr) {
                console.warn(`[MIGRATE-ACCOUNTS] Order re-link error for customer ${cust.id}: ${ordRelinkErr.message}`);
              }

              // Delete the duplicate customer
              const { error: delErr } = await admin
                .from("customers")
                .delete()
                .eq("id", cust.id);
              if (delErr) {
                console.warn(`[MIGRATE-ACCOUNTS] Error deleting duplicate customer ${cust.id}: ${delErr.message}`);
              }

              skipped++;
              continue;
            }
          }

          // Move the customer to the target account
          const { error: custMoveErr } = await admin
            .from("customers")
            .update({ account_id: toAccountId })
            .eq("id", cust.id);

          if (custMoveErr) {
            console.error(`[MIGRATE-ACCOUNTS] Error moving customer ${cust.id}: ${custMoveErr.message}`);
            errors.push({ table: "customers", id: cust.id, error: custMoveErr.message });
          } else {
            migrated++;
          }
        }

        console.log(`[MIGRATE-ACCOUNTS] customers: migrated ${migrated}, skipped ${skipped}`);
        counts.customers = { migrated, skipped };
      }
    } catch (custErr) {
      console.error(`[MIGRATE-ACCOUNTS] Unexpected error on customers:`, custErr);
      errors.push({ table: "customers", error: custErr.message });
      counts.customers = { migrated: 0, skipped: 0, error: custErr.message };
    }

    // ═══════════════════════════════════════
    // 4. Products
    // ═══════════════════════════════════════
    await migrateTable("products");

    // ═══════════════════════════════════════
    // 5. Orders
    // ═══════════════════════════════════════
    await migrateTable("orders");

    // ═══════════════════════════════════════
    // 6. FAQs
    // ═══════════════════════════════════════
    await migrateTable("faqs");

    // ═══════════════════════════════════════
    // 7. Quick Replies
    // ═══════════════════════════════════════
    await migrateTable("quick_replies");

    // ═══════════════════════════════════════
    // 8. Auto Replies
    // ═══════════════════════════════════════
    await migrateTable("auto_replies");

    // ═══════════════════════════════════════
    // 9. Campaigns
    // ═══════════════════════════════════════
    await migrateTable("campaigns");

    // ═══════════════════════════════════════
    // 10. Rate Limits (email column stores account_id)
    // ═══════════════════════════════════════
    await migrateTable("rate_limits", { column: "email", filterCol: "email", filterVal: fromAccountId });

    // ═══════════════════════════════════════
    // 11. Agent Actions
    // ═══════════════════════════════════════
    await migrateTable("agent_actions");

    // ═══════════════════════════════════════
    // 12. Update target business_name if it's "My Store"
    // ═══════════════════════════════════════
    let businessNameUpdated = false;
    try {
      if (sourceAccount.business_name && (targetAccount.business_name === "My Store" || !targetAccount.business_name)) {
        const { error: nameUpdateErr } = await admin
          .from("accounts")
          .update({ business_name: sourceAccount.business_name })
          .eq("id", toAccountId);

        if (nameUpdateErr) {
          console.warn(`[MIGRATE-ACCOUNTS] Could not update business_name: ${nameUpdateErr.message}`);
        } else {
          console.log(`[MIGRATE-ACCOUNTS] Updated target business_name to "${sourceAccount.business_name}"`);
          businessNameUpdated = true;
        }
      } else {
        console.log(`[MIGRATE-ACCOUNTS] Target business_name is "${targetAccount.business_name}" — keeping as-is`);
      }
    } catch (nameErr) {
      console.warn(`[MIGRATE-ACCOUNTS] Error updating business_name:`, nameErr);
    }

    // ═══════════════════════════════════════
    // Build summary
    // ═══════════════════════════════════════
    const summary = {};
    for (const [table, data] of Object.entries(counts)) {
      summary[table] = data.migrated;
    }

    console.log(`[MIGRATE-ACCOUNTS] Migration complete. Summary:`, summary);

    return NextResponse.json({
      success: true,
      from: { id: fromAccountId, email: sourceAccount.email },
      to: { id: toAccountId, email: targetAccount.email },
      businessNameUpdated,
      counts,
      summary,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    console.error("[MIGRATE-ACCOUNTS] Unhandled error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
