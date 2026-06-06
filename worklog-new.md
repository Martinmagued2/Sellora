# Sellora AI & Integration Fixes - Worklog

## Summary of Issues Found & Fixed

### 1. AI Conversation Feature (Simulator) — FIXED
**Root Causes:**
- **Critical bug in `bot.js` line 151**: `lastError: providerError;` was a JavaScript label statement (like `case:`), NOT an assignment. This meant `lastError` was never set, so errors were silently swallowed.
- **Deprecated model name in `index.js`**: Used `groq("meta-llama/llama-4-scout-17b-16e-instruct")` which doesn't exist in Groq's current API. Fixed to `groq("llama-3.3-70b-versatile")`.
- **Old Gemini model**: Used `gemini-1.5-flash`, updated to `gemini-2.0-flash` for consistency.
- **Cohere dependency**: All files imported Cohere and included it in fallback chains, causing potential issues if Cohere was the only fallback reached.

**Files Modified:**
- `src/lib/ai/index.js` — Fixed model names, removed Cohere from fallbacks
- `src/lib/ai/bot.js` — Fixed `lastError` bug, removed Cohere, updated models
- `src/lib/ai/router.js` — Removed Cohere import and fallback

### 2. AI Copilot Feature — FIXED (Session 1)
**Root Causes:**
- Cohere was in the provider fallback chain in both `chat/route.js` and `agent/route.js`
- Error messages referenced "COHERE_API_KEY" as a required key

**Files Modified:**
- `src/app/api/chat/route.js` — Removed Cohere, updated error messages
- `src/app/api/agent/route.js` — Removed Cohere, updated error messages

### 3. Shopify Integration — STRUCTURALLY CORRECT, NEEDS ENV VARS
**Status:**
- The Shopify integration code (connect, callback, sync, disconnect) is **structurally correct** and will work once the required environment variables are set.
- **Missing env vars needed:** `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and optionally `SHOPIFY_TOKEN_ENCRYPTION_KEY`
- Added proper HMAC verification in the webhooks route (was previously just a stub)
- Implemented the `app/uninstalled` handler to clean up DB records

**Files Modified:**
- `src/app/api/integrations/shopify/webhooks/route.js` — Added real HMAC verification and uninstall handler

### 4. WhatsApp Webhook — FIXED
**Root Cause:**
- `generateAIReply()` was being called with wrong parameters — it was passing `products`, `personality` etc. but the actual function signature requires `accountId`, `customerId`, `plan`, `businessName`, `country`, `conversationHistory`, etc. This would cause the WhatsApp AI auto-reply to fail silently.

**Files Modified:**
- `src/app/api/webhooks/whatsapp/route.js` — Fixed `generateAIReply()` call with correct parameters

### 5. Plan Limits — UPDATED
**Change:**
- Updated AI model mapping to use Groq/Gemini instead of OpenAI for smart and premium tiers

**Files Modified:**
- `src/lib/plan-limits.js` — Updated model mapping

---

## Session 2: AI Copilot Deep Fix

---
Task ID: 1
Agent: Main Agent (Super Z)
Task: Fix AI Copilot - text not showing, tools failing, customer insights loading forever

Work Log:
- Read current state of all 3 key files (copilot-tools.js, CopilotPanel.js, route.js)
- Identified root cause: generateText + manual createUIMessageStream doesn't produce correct format for useChat in AI SDK v6
- Switched API route from generateText+manual stream to streamText + toDataStreamResponse()
- streamText produces native format that useChat understands automatically (correct parts array)
- Rewrote CopilotPanel.js with proper AI SDK v6 message handling
- Made get_sales_report period optional with default month
- Expanded period normalization map with more aliases
- Made draft_product_description features optional
- Improved get_customer_insights description for better LLM tool selection
- Added error state styling for tool badges in CSS
- Prioritized Groq as first provider in fallback chain
- Build successful, pushed to fix/ai-copilot-shopify branch (commit 27b24cb)

Stage Summary:
- Key fix: Replaced broken generateText + createUIMessageStream with streamText
- All tool schemas now Groq-compatible
- Text output should now render properly via useChat native parts parsing
- Customer insights should work since tool execution + text response will stream correctly
