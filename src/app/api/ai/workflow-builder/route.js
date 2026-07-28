/**
 * POST /api/ai/workflow-builder
 *
 * AI Workflow Builder — converts a natural-language description into a
 * structured automation rule.
 *
 * Examples:
 *   "If someone asks about delivery after business hours, send shipping info
 *    and remind me tomorrow"
 *
 *   → {
 *       trigger: { type: "keyword", keywords: ["delivery", "shipping", "arrive"] },
 *       conditions: [{ type: "business_hours", value: "after" }],
 *       actions: [
 *         { type: "send_reply", message: "We ship within 2-3 business days..." },
 *         { type: "create_task", title: "Follow up about delivery", due: "tomorrow" }
 *       ]
 *     }
 *
 * The generated workflow is returned for the user to review + save. It's NOT
 * auto-saved — the user must confirm. This is critical because automations
 * can have real-world impact (sending messages to customers).
 *
 * Body: { description: "natural language description of the automation" }
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

    const { description } = await req.json();
    if (!description || typeof description !== "string" || description.trim().length < 10) {
      return NextResponse.json({ error: "Description must be at least 10 characters" }, { status: 400 });
    }

    // Try AI generation
    const model = buildStandaloneProvider();
    if (!model) {
      const ruleBased = ruleBasedWorkflow(description);
      return NextResponse.json({
        workflow: ruleBased,
        ai_powered: false,
        warning: "AI provider not configured — using basic keyword detection. Review carefully before saving.",
      });
    }

    const systemPrompt = `You are an AI automation builder for a customer messaging platform. Convert the user's natural-language description into a structured automation workflow.

Return ONLY a JSON object with this schema:
{
  "name": "Short name for the automation (max 50 chars)",
  "description": "One sentence describing what it does",
  "enabled": true,
  "trigger": {
    "type": "keyword" | "intent" | "new_conversation" | "no_reply" | "business_hours" | "customer_tag" | "order_status",
    "value": <depends on type — keywords array, intent name, hours, etc.>
  },
  "conditions": [
    {
      "type": "business_hours" | "channel" | "customer_tag" | "time_of_day" | "day_of_week" | "order_count",
      "value": "after" | "during" | "whatsapp" | "instagram" | etc.
    }
  ],
  "actions": [
    {
      "type": "send_reply" | "create_task" | "add_tag" | "send_notification" | "wait" | "escalate_to_human",
      "params": {
        "message": "the reply text (for send_reply)",
        "title": "task title (for create_task)",
        "due": "when the task is due (for create_task)",
        "tag": "tag name (for add_tag)",
        "delay_minutes": <number (for wait)>
      }
    }
  ]
}

Trigger types:
- keyword: fires when message contains specific keywords
- intent: fires when AI detects a specific intent (price_inquiry, complaint, etc.)
- new_conversation: fires on first message from a new customer
- no_reply: fires when customer hasn't replied in X hours
- business_hours: fires during/after business hours
- customer_tag: fires when customer has a specific tag

Action types:
- send_reply: send a message to the customer
- create_task: create a follow-up task
- add_tag: tag the customer
- send_notification: notify the team
- wait: delay before next action
- escalate_to_human: route to human agent

Rules:
1. Be conservative — only create automations that are clearly safe
2. If the description is ambiguous, return a workflow with a "needs_review" flag
3. Always include a "send_reply" action first (don't leave customers without a response)
4. Return ONLY JSON, no markdown`;

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: `Convert this automation description into a workflow:\n\n"${description}"`,
        temperature: 0.3,
        maxTokens: 800,
      });

      const text = result.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      const workflow = JSON.parse(text);

      return NextResponse.json({
        workflow,
        ai_powered: true,
        warning: "Review this workflow carefully before saving. AI-generated automations can have real-world impact.",
        generated_at: new Date().toISOString(),
      });
    } catch (llmErr) {
      console.warn("[WORKFLOW-BUILDER] LLM failed, using rules:", llmErr.message);
      const ruleBased = ruleBasedWorkflow(description);
      return NextResponse.json({
        workflow: ruleBased,
        ai_powered: false,
        warning: "AI parsing failed — using basic keyword detection. Review carefully.",
      });
    }
  } catch (e) {
    console.error("[WORKFLOW-BUILDER] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Rule-based workflow generation fallback.
 */
function ruleBasedWorkflow(description) {
  const desc = description.toLowerCase();

  // Detect trigger keywords
  const triggerKeywords = [];
  if (desc.includes("delivery") || desc.includes("shipping")) triggerKeywords.push("delivery", "shipping", "arrive", "ship");
  if (desc.includes("price") || desc.includes("cost") || desc.includes("how much")) triggerKeywords.push("price", "cost", "how much");
  if (desc.includes("hours") || desc.includes("open") || desc.includes("closed")) triggerKeywords.push("hours", "open", "closed");
  if (desc.includes("return") || desc.includes("refund")) triggerKeywords.push("return", "refund");
  if (desc.includes("order") || desc.includes("status")) triggerKeywords.push("order", "status", "track");

  // Detect conditions
  const conditions = [];
  if (desc.includes("after hours") || desc.includes("business hours") || desc.includes("after close")) {
    conditions.push({ type: "business_hours", value: "after" });
  }
  if (desc.includes("weekend") || desc.includes("saturday") || desc.includes("sunday")) {
    conditions.push({ type: "day_of_week", value: ["saturday", "sunday"] });
  }

  // Detect actions
  const actions = [];

  // Default reply
  let replyMessage = "Thanks for reaching out! We'll get back to you as soon as possible.";
  if (triggerKeywords.includes("delivery")) {
    replyMessage = "Hi! We typically ship within 1-2 business days, and delivery takes 2-3 days after that. Tracking info is sent once your order ships. Let me know if you have any other questions!";
  } else if (triggerKeywords.includes("price")) {
    replyMessage = "Hi! Our prices are listed on our website. Would you like me to send you a direct link, or help you place an order?";
  } else if (triggerKeywords.includes("hours")) {
    replyMessage = "Hi! Our business hours are 9 AM to 6 PM, Sunday through Thursday. We're closed on Fridays and Saturdays. Leave a message and we'll respond when we're back!";
  } else if (triggerKeywords.includes("return")) {
    replyMessage = "Hi! We accept returns within 14 days of delivery. Items must be unused and in original packaging. Would you like me to start a return request for you?";
  }
  actions.push({ type: "send_reply", params: { message: replyMessage } });

  // Task creation
  if (desc.includes("remind") || desc.includes("follow up") || desc.includes("task")) {
    const dueMatch = desc.match(/tomorrow|today|next week|in (\d+) days?/);
    const due = dueMatch ? dueMatch[0] : "tomorrow";
    actions.push({
      type: "create_task",
      params: {
        title: `Follow up: ${description.slice(0, 60)}`,
        due,
      },
    });
  }

  // Notification
  if (desc.includes("notify") || desc.includes("alert") || desc.includes("remind me")) {
    actions.push({
      type: "send_notification",
      params: { message: `Automation triggered: ${description.slice(0, 80)}` },
    });
  }

  return {
    name: description.slice(0, 50),
    description: description.slice(0, 200),
    enabled: false,  // Start disabled — user must review + enable
    needs_review: true,
    trigger: {
      type: "keyword",
      value: triggerKeywords.length > 0 ? triggerKeywords : ["help"],
    },
    conditions,
    actions,
  };
}
