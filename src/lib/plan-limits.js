/**
 * Plan Limits Configuration
 * 
 * Central source of truth for all plan-gated features.
 * Use -1 for unlimited. All other values are hard caps.
 */

export const PLAN_LIMITS = {
  starter: {
    // AI
    ai_model: "fast",             // Maps to Groq Llama 3
    ai_replies_per_day: 50,
    ai_simulate_per_day: 10,
    agent_routing: false,         // Sales agent only
    agent_tools: false,           // Chat only, no DB writes
    copilot_msgs_per_day: 10,     // Increased for testing

    // Scale
    channels: 1,
    products: 25,
    conversations_per_month: 100,
    customers: 200,
    stores: 1,

    // Features
    campaigns_per_month: 0,       // Locked
    auto_reply_rules: 3,
    coupons: 3,
    team_members: 1,              // Owner only

    // Capabilities
    analytics_full: false,
    custom_ai_personality: false,
    webhooks: false,
    data_retention_days: 30,
    csv_export: false,
  },

  professional: {
    // AI
    ai_model: "smart",            // Maps to OpenAI GPT-4o-mini
    ai_replies_per_day: 500,
    ai_simulate_per_day: 50,
    agent_routing: true,          // Multi-agent support
    agent_tools: true,            // Can create orders, etc.
    copilot_msgs_per_day: 50,

    // Scale
    channels: 2,
    products: -1,                 // Unlimited
    conversations_per_month: 1000,
    customers: -1,
    stores: 3,

    // Features
    campaigns_per_month: 5,
    auto_reply_rules: -1,
    coupons: 10,
    team_members: 3,

    // Capabilities
    analytics_full: true,
    custom_ai_personality: true,
    webhooks: true,
    data_retention_days: 180,     // 6 months
    csv_export: true,
  },

  business: {
    // AI
    ai_model: "premium",          // Maps to OpenAI GPT-4o
    ai_replies_per_day: -1,       // Unlimited
    ai_simulate_per_day: -1,
    agent_routing: true,          // Multi-agent support
    agent_tools: true,            // Can create orders, etc.
    copilot_msgs_per_day: -1,     // Unlimited

    // Scale
    channels: 3,
    products: -1,
    conversations_per_month: -1,
    customers: -1,
    stores: -1,                  // Unlimited

    // Features
    campaigns_per_month: -1,
    auto_reply_rules: -1,
    coupons: -1,                 // Unlimited
    team_members: -1,             // Unlimited

    // Capabilities
    analytics_full: true,
    custom_ai_personality: true,
    webhooks: true,
    data_retention_days: -1,      // Unlimited
    csv_export: true,
  },
};

/**
 * AI Model Mapping
 * Maps plan tier labels to actual provider + model configurations.
 * Uses Groq and Google Gemini (no Cohere or OpenAI required).
 */
export const AI_MODELS = {
  fast: {
    provider: "groq",
    model: "qwen-qwq-32b",
    label: "Groq (Qwen3 32B)",
  },
  smart: {
    provider: "google",
    model: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash (Smart)",
  },
  premium: {
    provider: "google",
    model: "gemini-2.5-flash-preview-05-20",
    label: "Gemini 2.5 Flash (Premium)",
  },
};

/**
 * Get limits for a given plan.
 * Falls back to 'starter' if plan is unknown.
 */
export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
}

/**
 * Check if usage exceeds a plan limit.
 * Returns true if the limit is exceeded, false if within limits.
 * A limit value of -1 means unlimited (never exceeded).
 */
export function isLimitExceeded(currentCount, limitValue) {
  if (limitValue === -1) return false; // Unlimited
  return currentCount >= limitValue;
}

/**
 * Get the AI model config for a given plan.
 */
export function getAIModelForPlan(plan) {
  const limits = getPlanLimits(plan);
  return AI_MODELS[limits.ai_model] || AI_MODELS.fast;
}
