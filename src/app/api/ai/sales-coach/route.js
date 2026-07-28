/**
 * POST /api/ai/sales-coach
 *
 * AI Sales Coach — analyzes a draft reply in real-time and provides:
 *   - Reply likelihood score (0-100%): how likely the customer is to respond
 *   - Tone analysis: friendly / professional / pushy / cold / generic
 *   - 3-5 specific improvement suggestions ("Ask one question", "Shorten by 30%",
 *     "Add urgency", "Mention the discount", "Personalize with their name")
 *   - Rewritten example showing the suggestions applied
 *
 * Designed to be called DEBOUNCED (every 2-3 seconds while the operator
 * types) — not on every keystroke. Falls back to rule-based scoring.
 *
 * Body:
 *   {
 *     draft: "the message being typed",
 *     customer_message: "the customer's last message (for context)",
 *     customer_name: "Sarah",
 *     conversation_history: ["msg1", "msg2", ...]  // optional, last 5 messages
 *   }
 */

import { NextResponse } from "next/server";
import { generateText } from "ai";
import { getAuthUser } from "@/lib/auth-helper";
import { buildStandaloneProvider } from "@/lib/ai/standalone-provider";

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { draft, customer_message, customer_name, conversation_history } = await req.json();

    if (!draft || typeof draft !== "string" || draft.trim().length < 5) {
      return NextResponse.json({
        score: null,
        suggestions: [],
        message: "Draft too short to analyze",
      });
    }

    // Try AI analysis
    const model = buildStandaloneProvider();
    if (!model) {
      const ruleBased = ruleBasedAnalysis(draft, customer_message, customer_name);
      return NextResponse.json({ ...ruleBased, ai_powered: false });
    }

    const systemPrompt = `You are an AI sales coach that helps operators write better replies. Analyze this draft message and predict how likely the customer is to reply.

Return ONLY a JSON object:
{
  "reply_likelihood": <0-100>,
  "tone": "friendly" | "professional" | "pushy" | "cold" | "generic" | "enthusiastic" | "apologetic",
  "strengths": ["what's good about the draft"],
  "suggestions": [
    {
      "type": "question" | "length" | "urgency" | "personalization" | "tone" | "clarity" | "call_to_action",
      "issue": "what could be improved",
      "fix": "specific actionable fix"
    }
  ],
  "rewritten_example": "a better version of the message applying all suggestions"
}

Scoring guide:
- 90-100: Excellent — clear question, personalized, right length, has CTA
- 70-89: Good — likely to get a reply but could be improved
- 50-69: Average — generic, missing a question, too long/short, or pushy
- 0-49: Poor — no question, too generic, pushy tone, or no clear CTA

Rules:
1. Always suggest at most 3 improvements (don't overwhelm)
2. Each suggestion must be SPECIFIC ("Shorten to 2 sentences" not "make it shorter")
3. The rewritten_example should be ready to send
4. Return ONLY JSON, no markdown`;

    const userPrompt = `Analyze this draft reply:

Draft: "${draft}"

Customer's last message: "${customer_message || "N/A"}"
Customer name: ${customer_name || "Unknown"}
Recent conversation: ${JSON.stringify((conversation_history || []).slice(-5))}`;

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        maxTokens: 600,
      });

      const text = result.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      const analysis = JSON.parse(text);

      return NextResponse.json({
        score: analysis.reply_likelihood,
        tone: analysis.tone,
        strengths: analysis.strengths || [],
        suggestions: analysis.suggestions || [],
        rewritten_example: analysis.rewritten_example,
        ai_powered: true,
      });
    } catch (llmErr) {
      console.warn("[SALES-COACH] LLM failed, using rules:", llmErr.message);
      const ruleBased = ruleBasedAnalysis(draft, customer_message, customer_name);
      return NextResponse.json({ ...ruleBased, ai_powered: false });
    }
  } catch (e) {
    console.error("[SALES-COACH] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Rule-based analysis fallback.
 */
function ruleBasedAnalysis(draft, customerMessage, customerName) {
  const text = draft.trim();
  const lowerText = text.toLowerCase();
  let score = 60;
  const suggestions = [];
  const strengths = [];

  // + Has a question
  if (/\?/.test(text)) {
    score += 15;
    strengths.push("Includes a question — encourages reply");
  } else {
    suggestions.push({
      type: "question",
      issue: "No question in the draft",
      fix: "End with a clear question to prompt a response (e.g., 'Does that work for you?')",
    });
    score -= 15;
  }

  // + Personalized (uses customer name)
  if (customerName && lowerText.includes(customerName.toLowerCase().split(" ")[0])) {
    score += 10;
    strengths.push("Personalized with customer's name");
  } else if (customerName) {
    suggestions.push({
      type: "personalization",
      issue: "Doesn't use the customer's name",
      fix: `Start with "Hi ${customerName.split(" ")[0]}" to make it more personal`,
    });
  }

  // Length check
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 10) {
    score -= 15;
    suggestions.push({
      type: "length",
      issue: "Message is very short",
      fix: "Add a bit more context — 2-3 sentences is ideal",
    });
  } else if (wordCount > 80) {
    score -= 10;
    suggestions.push({
      type: "length",
      issue: `Message is ${wordCount} words — might be too long`,
      fix: "Shorten to 30-50 words for better reply rates",
    });
  } else {
    strengths.push("Good length");
  }

  // Call to action
  if (/let me know|reply|get back|message me|shoot me|drop me|call me|click|book|order|buy|reserve/.test(lowerText)) {
    score += 10;
    strengths.push("Has a clear call to action");
  } else {
    suggestions.push({
      type: "call_to_action",
      issue: "No clear call to action",
      fix: "Add a specific next step (e.g., 'Reply YES to confirm' or 'Click here to order')",
    });
  }

  // Pushy tone detection
  if (/now|immediately|urgent|must|have to|last chance|only.*left|hurry/.test(lowerText)) {
    score -= 10;
    suggestions.push({
      type: "tone",
      issue: "Slightly pushy tone",
      fix: "Soften the urgency — use 'when you get a chance' instead of 'now'",
    });
  }

  // Generic greeting detection
  if (/^(hi|hello|hey|dear)\s*(customer|there|sir|madam)/i.test(text)) {
    score -= 10;
    suggestions.push({
      type: "personalization",
      issue: "Generic greeting",
      fix: customerName ? `Use their name: "Hi ${customerName.split(" ")[0]}"` : "Use the customer's name instead of 'customer'",
    });
  }

  score = Math.max(0, Math.min(100, score));

  // Determine tone
  let tone = "generic";
  if (/sorry|apologize|unfortunately/.test(lowerText)) tone = "apologetic";
  else if (/excited|amazing|love|fantastic|great news/.test(lowerText)) tone = "enthusiastic";
  else if (/now|immediately|urgent|hurry/.test(lowerText)) tone = "pushy";
  else if (/thank you|please|kindly|regards/.test(lowerText)) tone = "professional";
  else if (/hi|hey|hope you're|how are you/.test(lowerText)) tone = "friendly";

  return {
    score,
    tone,
    strengths,
    suggestions: suggestions.slice(0, 3),
    rewritten_example: null,  // Skip rewrite in rule-based mode
  };
}
