/**
 * Customer Assignment API
 * POST /api/customers/[id]/assign
 *   body: { assigneeId } — UUID of the team member (or owner) to assign to.
 *         Pass null/empty to unassign.
 *
 * Sends an email + dashboard notification to the new assignee.
 * Team-aware: any team member of the owner's account can assign.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { canAccessAccount, getActorName, getTeamMembers } from "@/lib/team-auth";
import { notify } from "@/lib/notifications";
import { sendCustomEmail, isEmailConfigured } from "@/lib/email";

let _admin = null;
function admin() {
  if (!_admin)
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  return _admin;
}

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: customerId } = await params;
    const { assigneeId } = await req.json();

    const db = admin();

    // Look up the customer
    const { data: customer, error: custErr } = await db
      .from("customers")
      .select("id, account_id, name, email, assigned_to")
      .eq("id", customerId)
      .maybeSingle();

    if (custErr || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Verify access
    const hasAccess = await canAccessAccount(user, customer.account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If assigneeId is provided, verify they're a valid team member or owner
    let assigneeEmail = null;
    let assigneeName = null;
    if (assigneeId) {
      const isOwner = assigneeId === customer.account_id;
      let isValid = isOwner;
      if (!isOwner) {
        const { data: tm } = await db
          .from("team_members")
          .select("id, name, display_name, invited_email, email")
          .eq("user_id", assigneeId)
          .eq("account_id", customer.account_id)
          .eq("invite_status", "accepted")
          .eq("status", "active")
          .maybeSingle();
        if (tm) {
          isValid = true;
          assigneeEmail = tm.email || tm.invited_email;
          assigneeName = tm.name || tm.display_name || tm.invited_email;
        }
      } else {
        // Owner
        const { data: owner } = await db
          .from("accounts")
          .select("email, owner_name")
          .eq("id", customer.account_id)
          .maybeSingle();
        assigneeEmail = owner?.email;
        assigneeName = owner?.owner_name || owner?.email;
      }
      if (!isValid) {
        return NextResponse.json({ error: "Assignee is not a team member" }, { status: 400 });
      }
    }

    // Update the customer
    const updates = {
      assigned_to: assigneeId || null,
      assigned_at: assigneeId ? new Date().toISOString() : null,
      assigned_by: assigneeId ? user.id : null,
    };
    const { data: updated, error: updateErr } = await db
      .from("customers")
      .update(updates)
      .eq("id", customerId)
      .select("id, name, email, assigned_to, assigned_at")
      .maybeSingle();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Notify the assignee (if not the actor + actually assigned)
    if (assigneeId && assigneeId !== user.id) {
      const actorName = await getActorName(user, customer.account_id);
      const custName = customer.name || customer.email || "a customer";

      // Dashboard notification
      try {
        await notify(customer.account_id, {
          category: "customers",
          type: "customer_assigned",
          title: `New customer assigned: ${custName}`,
          message: `${actorName} assigned customer "${custName}" to you.`,
          priority: "high",
          actionUrl: `/dashboard/customers/${customerId}`,
          actionLabel: "Open customer",
          userId: assigneeId,
          related_id: customerId,
          related_type: "customer",
        });
      } catch (e) {
        console.warn("[ASSIGN] notify failed:", e.message);
      }

      // ALWAYS send email for customer assignments (bypass prefs)
      if (assigneeEmail && isEmailConfigured()) {
        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sellorachat.com";
          await sendCustomEmail({
            to: assigneeEmail,
            subject: `[Sellora] New customer assigned: ${custName}`,
            html: `
              <h1>New customer assigned to you 👋</h1>
              <p>Hi ${assigneeName || "there"},</p>
              <p>${actorName} just assigned a customer to you on Sellora:</p>
              <div class="info-box">
                <div class="info-label">Customer</div>
                <div class="info-text">
                  <strong>${custName}</strong>${customer.email ? `<br>${customer.email}` : ""}
                </div>
              </div>
              <p>Open the customer profile to view their conversation history, orders, and tasks.</p>
              <p><a href="${appUrl}/dashboard/customers/${customerId}" class="btn">Open Customer →</a></p>
              <p style="font-size:13px;color:#6b7280;margin-top:16px;">You received this email because a team member assigned a customer to you on Sellora.</p>
            `,
            templateName: "customer_assigned",
            accountId: customer.account_id,
            metadata: { customerId, customerName: custName },
          });
        } catch (e) {
          console.warn("[ASSIGN] email failed:", e.message);
        }
      }
    }

    return NextResponse.json({ success: true, customer: updated });
  } catch (e) {
    console.error("[ASSIGN] error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
