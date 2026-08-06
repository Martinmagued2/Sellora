-- Supabase Migration: 078_sellora_flagships.sql
-- 6 Flagship Features: Intent Radar, Social Haggling, Creative Studio, Safety Guardrails

-- 1. Intent Radar & Live Sessions
CREATE TABLE IF NOT EXISTS public.intent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    customer_name TEXT DEFAULT 'Anonymous Visitor',
    current_page TEXT,
    intent_score INT DEFAULT 50, -- 0 to 100
    status TEXT DEFAULT 'browsing', -- 'browsing', 'hesitating', 'high_intent', 'converted', 'abandoned'
    cart_value NUMERIC(10, 2) DEFAULT 0.00,
    micro_offer_sent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Social Selling & Haggle Engine Settings
CREATE TABLE IF NOT EXISTS public.social_haggle_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE UNIQUE,
    is_enabled BOOLEAN DEFAULT true,
    max_discount_pct INT DEFAULT 15,
    min_margin_pct INT DEFAULT 20,
    personality_style TEXT DEFAULT 'friendly_negotiator', -- 'strict', 'friendly_negotiator', 'generous_closer'
    auto_generate_checkout_links BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. AI Creative Studio Generated Assets
CREATE TABLE IF NOT EXISTS public.creative_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    target_audience TEXT,
    campaign_style TEXT, -- 'Luxury', 'FOMO / Urgent', 'Social Proof'
    generated_headline TEXT,
    generated_body TEXT,
    call_to_action TEXT,
    image_prompt TEXT,
    status TEXT DEFAULT 'ready',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. AI Hallucination & Safety Logs
CREATE TABLE IF NOT EXISTS public.ai_safety_shield_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    prompt_input TEXT,
    raw_ai_output TEXT,
    sanitized_output TEXT,
    confidence_score INT DEFAULT 95,
    flagged_issues TEXT[],
    action_taken TEXT DEFAULT 'passed', -- 'passed', 'sanitized', 'blocked_price_guardrail', 'routed_to_human'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS Policies
ALTER TABLE public.intent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_haggle_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_safety_shield_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write intent sessions" ON public.intent_sessions FOR ALL USING (true);
CREATE POLICY "Allow store access haggle settings" ON public.social_haggle_settings FOR ALL USING (true);
CREATE POLICY "Allow store access creative assets" ON public.creative_assets FOR ALL USING (true);
CREATE POLICY "Allow store access ai safety logs" ON public.ai_safety_shield_logs FOR ALL USING (true);
