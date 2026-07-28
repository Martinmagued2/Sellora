/**
 * POST /api/ai/meeting-mode
 *
 * AI Meeting Mode — after a support call or meeting, paste the transcript
 * (or notes) and AI creates:
 *   - Structured summary
 *   - Follow-up tasks (auto-created in customer_tasks)
 *   - CRM updates (tags, notes, lifecycle stage)
 *   - Next reminder (scheduled task)
 *
 * Eliminates manual note-taking after calls.
 *
 * Body:
 *   {
 *     transcript: "the call transcript or notes",
 *     customer_id: "uuid",       // optional — links tasks to this customer
 *     meeting_title: "Support call with Sarah",
 *     meeting_date: "2026-07-23T...",  // optional, defaults to now
 *     auto_create_tasks: true    // default: false — user must confirm
 *   }
 *
 * Response:
 *   {
 *     summary: "1-paragraph summary",
 *     key_points: ["point 1", "point 2", ...],
 *     decisions: ["decision 1", ...],
 *     action_items: [
 *       { task, assignee, due_date, priority, task_id? }
 *     ],
 *     crm_updates: {
 *       tags_to_add: ["vip", "needs_followup"],
 *       notes_to_add: "Internal note from meeting",
 *       lifecycle_stage_change: "customer" | null
 *     },
 *     next_reminder: {
 *       date: "2026-07-25",
 *       reason: "Follow up on refund processing"
 *     },
 *     customer_mood: "positive" | "neutral" | "negative",
 *     ai_powered: true
 *   }
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

    const { transcript, customer_id, meeting_title, meeting_date, auto_create_tasks } = await req.json();

    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 20) {
      return NextResponse.json({ error: "transcript is required (min 20 chars)" }, { status: 400 });
    }

    // Verify customer belongs to account (if customer_id provided)
    const db = admin();
    let customer = null;
    if (customer_id) {
      const { data: c } = await db.from("customers")
        .select("id, name, account_id, tags, lifecycle_stage")
        .eq("id", customer_id)
        .eq("account_id", effectiveAccountId)
        .maybeSingle();
      if (c) customer = c;
    }

    // Try AI analysis
    const model = buildStandaloneProvider();
    if (!model) {
      const ruleBased = ruleBasedMeeting(transcript, meeting_title, customer);
      return NextResponse.json({ ...ruleBased, ai_powered: false });
    }

    const systemPrompt = `You are an AI meeting assistant. Analyze this meeting/call transcript and produce a structured summary with action items, CRM updates, and reminders.

Return ONLY a JSON object:
{
  "summary": "1 paragraph summary of the meeting",
  "key_points": ["3-5 key points discussed"],
  "decisions": ["decisions made during the meeting"],
  "action_items": [
    {
      "task": "specific action to take",
      "assignee": "who should do it (operator name or 'me')",
      "due_date": "YYYY-MM-DD or null",
      "priority": "high" | "medium" | "low"
    }
  ],
  "crm_updates": {
    "tags_to_add": ["tag1", "tag2"],
    "notes_to_add": "internal note summarizing meeting outcome",
    "lifecycle_stage_change": "lead" | "prospect" | "customer" | "churned" | "reactivated" | null
  },
  "next_reminder": {
    "date": "YYYY-MM-DD or null",
    "reason": "why this reminder is needed"
  },
  "customer_mood": "positive" | "neutral" | "negative"
}

Rules:
1. action_items: extract concrete, assignable tasks with due dates
2. crm_updates.tags_to_add: only suggest tags that are meaningful (e.g., "vip", "needs_followup", "at_risk")
3. crm_updates.lifecycle_stage_change: only suggest if the meeting clearly indicates a stage transition
4. next_reminder: schedule a follow-up if there's a clear reason
5. customer_mood: based on the overall tone of the meeting
6. Return ONLY JSON, no markdown`;

    const contextStr = customer ? `
Customer context:
- Name: ${customer.name}
- Current tags: ${JSON.stringify(customer.tags || [])}
- Current lifecycle stage: ${customer.lifecycle_stage || "unknown"}
` : `
Customer context: (no specific customer linked)
`;

    const userPrompt = `Analyze this meeting transcript:

Meeting title: ${meeting_title || "Support call"}
Date: ${meeting_date || new Date().toISOString()}
${contextStr}

Transcript:
"${transcript}"`;

    let analysis;
    let aiPowered = true;

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        maxTokens: 1000,
      });

      const text = result.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      analysis = JSON.parse(text);
    } catch (llmErr) {
      console.warn("[MEETING-MODE] LLM failed, using rules:", llmErr.message);
      analysis = ruleBasedMeeting(transcript, meeting_title, customer);
      aiPowered = false;
    }

    // Auto-create tasks if requested
    if (auto_create_tasks && customer && analysis.action_items?.length > 0) {
      const createdTasks = [];
      for (const item of analysis.action_items.slice(0, 5)) {
        try {
          const { data: task } = await db.from("customer_tasks").insert({
            account_id: effectiveAccountId,
            customer_id: customer.id,
            title: item.task,
            description: `Created from meeting: ${meeting_title || "Support call"}`,
            due_date: item.due_date ? new Date(item.due_date).toISOString() : null,
            priority: item.priority || "normal",
            status: "unseen",
            assigned_to: user.id,
            assigned_name: item.assignee === "me" ? "You" : (item.assignee || "You"),
          }).select().single();
          if (task) {
            createdTasks.push({ ...item, task_id: task.id });
          }
        } catch (taskErr) {
          console.warn("[MEETING-MODE] Failed to create task:", taskErr.message);
        }
      }
      analysis.action_items = createdTasks;

      // Add CRM tags
      if (analysis.crm_updates?.tags_to_add?.length > 0) {
        const currentTags = customer.tags || [];
        const newTags = [...new Set([...currentTags, ...analysis.crm_updates.tags_to_add])];
        await db.from("customers").update({ tags: newTags }).eq("id", customer.id);
      }

      // Add note
      if (analysis.crm_updates?.notes_to_add) {
        await db.from("customer_notes").insert({
          account_id: effectiveAccountId,
          customer_id: customer.id,
          note: `[Meeting ${meeting_title || ""} — ${new Date().toLocaleDateString()}]\n${analysis.crm_updates.notes_to_add}`,
          author_id: user.id,
          author_name: user.email?.split("@")[0] || "AI Meeting Mode",
        });
      }

      // Update lifecycle stage
      if (analysis.crm_updates?.lifecycle_stage_change && customer.lifecycle_stage !== analysis.crm_updates.lifecycle_stage_change) {
        await db.from("customers").update({
          lifecycle_stage: analysis.crm_updates.lifecycle_stage_change,
        }).eq("id", customer.id);
      }
    }

    return NextResponse.json({
      ...analysis,
      ai_powered: aiPowered,
      tasks_created: auto_create_tasks === true,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[MEETING-MODE] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Rule-based meeting analysis fallback.
 */
function ruleBasedMeeting(transcript, title, customer) {
  const text = transcript.toLowerCase();
  const actionItems = [];
  const keyPoints = [];
  const decisions = [];

  // Detect action items by keywords
  if (/follow up|followup|check back|get back to/.test(text)) {
    actionItems.push({
      task: "Follow up with customer",
      assignee: "me",
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      priority: "medium",
    });
  }
  if (/refund|money back|reimburse/.test(text)) {
    actionItems.push({
      task: "Process refund request",
      assignee: "me",
      due_date: new Date().toISOString().slice(0, 10),
      priority: "high",
    });
    keyPoints.push("Customer requested a refund");
  }
  if (/replace|replacement|exchange|swap/.test(text)) {
    actionItems.push({
      task: "Arrange product replacement",
      assignee: "me",
      due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      priority: "medium",
    });
    keyPoints.push("Product replacement discussed");
  }
  if (/escalate|manager|supervisor|senior/.test(text)) {
    actionItems.push({
      task: "Escalate to manager",
      assignee: "me",
      due_date: new Date().toISOString().slice(0, 10),
      priority: "high",
    });
    decisions.push("Escalation requested");
  }
  if (/discount|credit|compensat/.test(text)) {
    actionItems.push({
      task: "Apply discount/credit to account",
      assignee: "me",
      due_date: new Date().toISOString().slice(0, 10),
      priority: "medium",
    });
    decisions.push("Discount/credit offered");
  }

  // Detect mood
  let mood = "neutral";
  if (/angry|frustrat|upset|unhappy|disappointed/.test(text)) mood = "negative";
  else if (/happy|thank|great|excellent|pleased|satisfied/.test(text)) mood = "positive";

  // Detect key topics
  if (/delivery|shipping|arrive/.test(text)) keyPoints.push("Delivery/shipping discussed");
  if (/product quality|broken|damaged|defective/.test(text)) keyPoints.push("Product quality issue raised");
  if (/price|pricing|cost|expensive/.test(text)) keyPoints.push("Pricing discussed");
  if (/order|order status|track/.test(text)) keyPoints.push("Order status discussed");

  // Tags
  const tagsToAdd = [];
  if (mood === "negative") tagsToAdd.push("at_risk");
  if (/vip|loyal|frequent|repeat/.test(text)) tagsToAdd.push("vip");
  if (/follow up|followup/.test(text)) tagsToAdd.push("needs_followup");

  return {
    summary: `${title || "Meeting"} on ${new Date().toLocaleDateString()}. ${keyPoints.join(". ") || "General discussion."}`,
    key_points: keyPoints.length > 0 ? keyPoints : ["General support discussion"],
    decisions: decisions.length > 0 ? decisions : ["No specific decisions documented"],
    action_items: actionItems.length > 0 ? actionItems : [{
      task: "Review meeting notes and follow up as needed",
      assignee: "me",
      due_date: null,
      priority: "low",
    }],
    crm_updates: {
      tags_to_add: tagsToAdd,
      notes_to_add: `Meeting on ${new Date().toLocaleDateString()}: ${transcript.slice(0, 200)}`,
      lifecycle_stage_change: null,
    },
    next_reminder: actionItems.length > 0 ? {
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      reason: "Follow up on action items from meeting",
    } : { date: null, reason: null },
    customer_mood: mood,
  };
}
