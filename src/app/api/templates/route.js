/**
 * Templates API
 *
 * Two template marketplaces are served from this route:
 *
 *   1. WhatsApp template library (legacy):
 *        GET /api/templates                     → list wa_template_library
 *        GET /api/templates?type=whatsapp       → same (explicit)
 *
 *   2. Store templates marketplace (Item #5):
 *        GET  /api/templates?type=store         → list store_templates (with install status)
 *        GET  /api/templates?type=store&category=fashion
 *        POST /api/templates?type=store         → install a template into the caller's account
 *             body: { template_id: <uuid>, options?: { skip_products?, skip_faqs?, skip_policies?, skip_coupons?, skip_personality?, skip_greeting? } }
 *
 * Installing a store template copies the template's:
 *   - products         → products table (status='active')
 *   - faqs             → faqs table
 *   - policies         → business_policies table
 *   - coupons          → coupons table (codes prefixed to avoid collisions)
 *   - ai_personality   → accounts.ai_personality_*
 *   - greeting_message → accounts.auto_greeting_message + accounts.auto_greeting=true
 *
 * Idempotent: a (account_id, template_id) install is recorded in store_template_installs.
 * Re-installing updates the existing install row and re-copies (codes are suffixed with a
 * short random string to avoid collisions).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

const VALID_STORE_CATEGORIES = ["fashion", "cosmetics", "electronics", "restaurant", "realestate", "general"];

// ──────────────────────────────────────────────────────────────────
// GET
// ──────────────────────────────────────────────────────────────────
export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "whatsapp";
    const admin = getAdminClient();

    // ─── Store templates marketplace ───
    if (type === "store") {
      const category = searchParams.get("category");
      let query = admin
        .from("store_templates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (category && VALID_STORE_CATEGORIES.includes(category)) {
        query = query.eq("category", category);
      }
      const { data: templates, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Mark which ones the caller has already installed.
      const { data: installs } = await admin
        .from("store_template_installs")
        .select("template_id, created_at")
        .eq("account_id", user.id);
      const installedMap = new Map((installs || []).map((i) => [i.template_id, i.created_at]));

      const enriched = (templates || []).map((t) => ({
        ...t,
        installed: installedMap.has(t.id),
        installed_at: installedMap.get(t.id) || null,
        // Add convenience counts so the UI doesn't have to parse JSON.
        product_count: Array.isArray(t.config?.products) ? t.config.products.length : 0,
        faq_count: Array.isArray(t.config?.faqs) ? t.config.faqs.length : 0,
        policy_count: Array.isArray(t.config?.policies) ? t.config.policies.length : 0,
        coupon_count: Array.isArray(t.config?.coupons) ? t.config.coupons.length : 0,
      }));

      return NextResponse.json({ templates: enriched });
    }

    // ─── Default: WhatsApp template library (legacy behaviour) ───
    const { data } = await admin
      .from("wa_template_library")
      .select("*")
      .order("category", { ascending: true });
    return NextResponse.json({ templates: data || [] });
  } catch (e) {
    console.error("[templates] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────────
// POST — install a store template
// ──────────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "whatsapp";
    if (type !== "store") {
      return NextResponse.json(
        { error: "POST is only supported for ?type=store" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const templateId = body.template_id;
    if (!templateId) {
      return NextResponse.json({ error: "template_id is required" }, { status: 400 });
    }
    const options = body.options || {};

    const admin = getAdminClient();

    // 1. Fetch the template.
    const { data: template, error: tplErr } = await admin
      .from("store_templates")
      .select("*")
      .eq("id", templateId)
      .eq("is_active", true)
      .maybeSingle();
    if (tplErr || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const config = template.config || {};
    const stats = {
      products: 0, faqs: 0, policies: 0, coupons: 0, personality: false, greeting: false,
    };

    // 2. Products
    if (!options.skip_products && Array.isArray(config.products) && config.products.length > 0) {
      const rows = config.products.map((p) => ({
        account_id: user.id,
        name: p.name,
        description: p.description || null,
        price: Number(p.price) || 0,
        currency: p.currency || "EGP",
        category: p.category || null,
        image_urls: Array.isArray(p.image_urls) ? p.image_urls : [],
        stock: Number(p.stock) || 0,
        status: "active",
      }));
      const { data, error } = await admin.from("products").insert(rows).select("id");
      if (error) {
        console.error("[templates] product insert error:", error.message);
      } else {
        stats.products = data?.length || 0;
      }
    }

    // 3. FAQs
    if (!options.skip_faqs && Array.isArray(config.faqs) && config.faqs.length > 0) {
      const rows = config.faqs.map((f) => ({
        account_id: user.id,
        question: f.question,
        answer: f.answer,
        category: f.category || "General",
        is_active: true,
      }));
      const { data, error } = await admin.from("faqs").insert(rows).select("id");
      if (error) {
        console.error("[templates] faq insert error:", error.message);
      } else {
        stats.faqs = data?.length || 0;
      }
    }

    // 4. Policies
    if (!options.skip_policies && Array.isArray(config.policies) && config.policies.length > 0) {
      const rows = config.policies.map((p) => ({
        account_id: user.id,
        title: p.title,
        content: p.content,
        category: p.category || "General",
        is_active: true,
        sort_order: 0,
      }));
      const { data, error } = await admin.from("business_policies").insert(rows).select("id");
      if (error) {
        console.error("[templates] policy insert error:", error.message);
      } else {
        stats.policies = data?.length || 0;
      }
    }

    // 5. Coupons (codes suffixed to avoid collisions on re-install)
    if (!options.skip_coupons && Array.isArray(config.coupons) && config.coupons.length > 0) {
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      const rows = config.coupons.map((c) => ({
        account_id: user.id,
        code: `${(c.code || "PROMO").toUpperCase()}-${suffix}`,
        type: ["percentage", "fixed", "free_shipping"].includes(c.type) ? c.type : "percentage",
        value: Number(c.value) || 0,
        min_order_value: Number(c.min_order_value) || 0,
        max_uses: c.max_uses ?? null,
        used_count: 0,
        is_active: true,
      }));
      const { data, error } = await admin.from("coupons").insert(rows).select("id");
      if (error) {
        console.error("[templates] coupon insert error:", error.message);
      } else {
        stats.coupons = data?.length || 0;
      }
    }

    // 6. AI personality + greeting message
    if (!options.skip_personality && config.ai_personality) {
      const ai = config.ai_personality;
      const update = {};
      // Map the template tone to the closest supported ai_personality_type.
      const toneToType = {
        professional: "professional",
        "professional, knowledgeable, consultative": "professional",
        knowledgeable: "professional",
        luxury: "luxury",
        "premium and sophisticated": "luxury",
        playful: "playful",
        fun: "playful",
        casual: "casual",
        "casual and relaxed": "casual",
        friendly: "friendly",
        "friendly, fashion-savvy, helpful": "friendly",
        "warm, appetizing, hospitable": "friendly",
        "warm, friendly, beauty-expert": "friendly",
        "knowledgeable, warm, beauty-expert": "friendly",
        "precise, helpful, tech-savvy": "professional",
      };
      if (ai.tone) {
        update.ai_personality_type = toneToType[ai.tone.toLowerCase()] || "friendly";
      }
      if (ai.system_prompt) {
        update.ai_custom_description = ai.system_prompt;
      }
      // Compose the ai_personality text used by the bot runtime.
      if (ai.system_prompt || ai.tone) {
        update.ai_personality = [
          ai.system_prompt || "",
          ai.tone ? `\nTone: ${ai.tone}.` : "",
          "Use emojis sparingly and appropriately.",
        ].join("").trim();
      }
      if (Object.keys(update).length > 0) {
        const { error } = await admin.from("accounts").update(update).eq("id", user.id);
        if (error) {
          console.error("[templates] ai_personality update error:", error.message);
        } else {
          stats.personality = true;
        }
      }
    }

    if (!options.skip_greeting && config.greeting_message) {
      const { error } = await admin.from("accounts").update({
        auto_greeting: true,
        auto_greeting_message: config.greeting_message,
      }).eq("id", user.id);
      if (error) {
        console.error("[templates] greeting update error:", error.message);
      } else {
        stats.greeting = true;
      }
    }

    // 7. Record the install (idempotent via UNIQUE(account_id, template_id)).
    const { error: installErr } = await admin
      .from("store_template_installs")
      .upsert({
        account_id: user.id,
        template_id: template.id,
        installed_products: stats.products,
        installed_faqs: stats.faqs,
        installed_policies: stats.policies,
        installed_coupons: stats.coupons,
        installed_personality: stats.personality,
        installed_greeting: stats.greeting,
      }, { onConflict: "account_id,template_id" });
    if (installErr) {
      console.error("[templates] install record error:", installErr.message);
    }

    return NextResponse.json({
      success: true,
      template: { id: template.id, name: template.name, category: template.category },
      installed: stats,
      message: `Installed "${template.name}" — ${stats.products} products, ${stats.faqs} FAQs, ${stats.policies} policies, ${stats.coupons} coupons added.`,
    });
  } catch (e) {
    console.error("[templates] POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
