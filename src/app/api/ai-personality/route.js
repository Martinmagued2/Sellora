import { createClient } from "@/lib/supabase/server";

// GET: Fetch current AI personality settings for authenticated user
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("accounts")
      .select(`
        ai_name,
        ai_avatar,
        ai_personality,
        ai_personality_type,
        ai_custom_description,
        ai_formality,
        ai_enthusiasm,
        ai_verbosity,
        ai_empathy,
        ai_max_response_length,
        ai_auto_suggest_products,
        ai_auto_collect_email,
        ai_auto_collect_phone,
        ai_escalation_keywords,
        ai_forbidden_topics,
        auto_greeting,
        auto_greeting_message,
        greeting_per_channel,
        instagram_greeting,
        facebook_greeting,
        whatsapp_greeting,
        greeting_delay_seconds,
        business_name,
        country
      `)
      .eq("id", user.id)
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ settings: data });
  } catch (err) {
    console.error("AI personality GET error:", err);
    return Response.json({ error: "Failed to fetch AI personality settings" }, { status: 500 });
  }
}

// PUT: Save AI personality settings
export async function PUT(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const updateData = {};
    const allowedFields = [
      "ai_name",
      "ai_avatar",
      "ai_personality_type",
      "ai_custom_description",
      "ai_formality",
      "ai_enthusiasm",
      "ai_verbosity",
      "ai_empathy",
      "ai_max_response_length",
      "ai_auto_suggest_products",
      "ai_auto_collect_email",
      "ai_auto_collect_phone",
      "ai_escalation_keywords",
      "ai_forbidden_topics",
      "auto_greeting",
      "auto_greeting_message",
      "greeting_per_channel",
      "instagram_greeting",
      "facebook_greeting",
      "whatsapp_greeting",
      "greeting_delay_seconds",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Also build and update the ai_personality text field from the personality settings
    if (body.ai_personality_type || body.ai_custom_description || body.ai_formality || body.ai_enthusiasm || body.ai_verbosity || body.ai_empathy) {
      const personalityType = body.ai_personality_type || "friendly";
      const customDesc = body.ai_custom_description || "";
      const formality = body.ai_formality ?? 5;
      const enthusiasm = body.ai_enthusiasm ?? 7;
      const verbosity = body.ai_verbosity ?? 5;
      const empathy = body.ai_empathy ?? 7;
      const aiName = body.ai_name || "Sellora AI";
      const forbiddenTopics = body.ai_forbidden_topics || [];
      const escalationKeywords = body.ai_escalation_keywords || ["human", "agent", "manager", "complaint"];

      // Build a comprehensive personality description
      const personalityLabels = {
        professional: "Professional and business-like",
        friendly: "Friendly and approachable",
        casual: "Casual and relaxed",
        luxury: "Premium and sophisticated",
        playful: "Playful and fun",
      };

      const formalityDesc = formality <= 3 ? "very casual and informal" : formality <= 6 ? "moderately formal" : "very formal and professional";
      const enthusiasmDesc = enthusiasm <= 3 ? "calm and measured" : enthusiasm <= 6 ? "moderately enthusiastic" : "highly energetic and enthusiastic";
      const verbosityDesc = verbosity <= 3 ? "concise and to-the-point" : verbosity <= 6 ? "moderately detailed" : "thorough and detailed";
      const empathyDesc = empathy <= 3 ? "factual and direct" : empathy <= 6 ? "moderately empathetic" : "deeply empathetic and caring";

      let personalityText = `You are ${aiName}, a ${personalityLabels[personalityType] || "friendly"} AI assistant. `;
      personalityText += `Your communication style is ${formalityDesc}, ${enthusiasmDesc}, ${verbosityDesc}, and ${empathyDesc}. `;

      if (customDesc && customDesc.trim()) {
        personalityText += `Custom personality override: ${customDesc.trim()}. `;
      }

      if (forbiddenTopics.length > 0) {
        personalityText += `NEVER discuss these topics: ${forbiddenTopics.join(", ")}. `;
      }

      if (escalationKeywords.length > 0) {
        personalityText += `If the customer mentions any of these keywords: ${escalationKeywords.join(", ")}, escalate to a human agent. `;
      }

      personalityText += "Use emojis sparingly and appropriately.";

      updateData.ai_personality = personalityText;
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

    return Response.json({ success: true, message: "AI personality settings saved" });
  } catch (err) {
    console.error("AI personality PUT error:", err);
    return Response.json({ error: "Failed to save AI personality settings" }, { status: 500 });
  }
}
