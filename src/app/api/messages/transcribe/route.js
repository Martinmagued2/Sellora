import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import ZAI from "z-ai-web-dev-sdk";
import { generateAIReply } from "@/lib/ai/index";

export async function POST(req) {
  try {
    // ─── Auth ───
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ─── Parse input ───
    const body = await req.json();
    const { audio_base64, conversation_id, generate_response = true } = body;

    if (!audio_base64) {
      return Response.json({ error: "No audio data provided" }, { status: 400 });
    }

    // ─── Transcribe using z-ai-web-dev-sdk ASR ───
    let transcribedText = "";

    try {
      const zai = await ZAI.create();
      const result = await zai.audio.asr.create({
        file_base64: audio_base64,
      });

      transcribedText = result.text || result.transcription || "";

      if (typeof result === "string") {
        transcribedText = result;
      }

      console.log("[Transcribe] ASR result:", transcribedText.substring(0, 100));
    } catch (asrError) {
      console.error("[Transcribe] ASR failed:", asrError?.message || asrError);
      // Fallback: try with the project's existing AI providers using a simple prompt
      try {
        const { generateText } = await import("ai");
        const { groq } = await import("@ai-sdk/groq");

        if (process.env.GROQ_API_KEY) {
          // Use Groq's Whisper API-compatible endpoint
          const formData = new FormData();
          const audioBuffer = Buffer.from(audio_base64, "base64");
          const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });
          formData.append("file", audioBlob, "audio.webm");
          formData.append("model", "whisper-large-v3");

          const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: formData,
          });

          if (groqRes.ok) {
            const groqData = await groqRes.json();
            transcribedText = groqData.text || "";
            console.log("[Transcribe] Groq Whisper fallback:", transcribedText.substring(0, 100));
          } else {
            const errText = await groqRes.text();
            console.error("[Transcribe] Groq Whisper failed:", errText.substring(0, 200));
          }
        }
      } catch (fallbackErr) {
        console.error("[Transcribe] Fallback transcription failed:", fallbackErr?.message);
      }
    }

    if (!transcribedText || !transcribedText.trim()) {
      return Response.json({
        success: true,
        transcription: "",
        message: "Could not transcribe audio. Please try again or type your message.",
      });
    }

    // ─── Generate AI response if requested ───
    let aiResponse = null;
    if (generate_response && conversation_id) {
      try {
        // Fetch account and conversation context
        const adminClient = (await import("@supabase/supabase-js")).createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: account } = await adminClient
          .from("accounts")
          .select("plan, business_name, country, currency")
          .eq("id", user.id)
          .single();

        const { data: conversation } = await adminClient
          .from("conversations")
          .select("id, customer_id, channel")
          .eq("id", conversation_id)
          .eq("account_id", user.id)  // SECURITY: Ownership check prevents IDOR
          .single();

        if (conversation?.customer_id) {
          const { data: customer } = await adminClient
            .from("customers")
            .select("name")
            .eq("id", conversation.customer_id)
            .single();

          const { data: recentMessages } = await adminClient
            .from("messages")
            .select("content, direction, is_ai, created_at")
            .eq("conversation_id", conversation_id)
            .order("created_at", { ascending: false })
            .limit(6);

          const conversationHistory = (recentMessages || [])
            .reverse()
            .map((m) => ({
              content: m.content,
              direction: m.direction,
              is_ai: m.is_ai,
              created_at: m.created_at,
            }));

          const aiResult = await generateAIReply({
            accountId: user.id,
            customerId: conversation.customer_id,
            customerMessage: transcribedText,
            customerName: customer?.name || "Customer",
            personality: "",
            country: account?.country || "Egypt",
            businessName: account?.business_name || "My Store",
            conversationHistory,
            plan: account?.plan || "starter",
          });

          aiResponse = aiResult.reply || null;
        }
      } catch (aiErr) {
        console.error("[Transcribe] AI response generation failed:", aiErr?.message);
      }
    }

    return Response.json({
      success: true,
      transcription: transcribedText,
      ai_response: aiResponse,
    });
  } catch (error) {
    console.error("[Transcribe] Error:", error);
    return Response.json(
      { error: error.message || "Transcription failed" },
      { status: 500 }
    );
  }
}
