# Sellora — AI-Powered Social Commerce SaaS

> Conversational commerce platform for MENA SMBs. Unify WhatsApp, Instagram, Facebook, Telegram & Email into one AI-powered dashboard.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ 
- Supabase account (free tier works)
- Vercel account (free tier works)
- At least one AI API key (Groq, Google Gemini, or OpenAI)

### 1. Install dependencies
```bash
npm install
```

### 2. Environment variables
Copy `.env.example` to `.env.local` and fill in your values:
```bash
cp .env.example .env.local
```

### 3. Database setup
1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor → paste the contents of `supabase/migrations/PRODUCTION_SETUP.sql` → Run
3. This creates all 56 tables, indexes, RLS policies, and storage buckets

### 4. Run locally
```bash
npm run dev
```
Visit http://localhost:3000

### 5. Deploy to Vercel
1. Push to GitHub
2. Import to Vercel
3. Add all environment variables (see below)
4. Deploy

## 📋 Environment Variables

### Required
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `CRON_SECRET` | Secret for cron job authentication |

### AI Providers (at least one required)
| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Groq API key (free tier available) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini API key (free tier available) |
| `OPENAI_API_KEY` | OpenAI API key (paid) |
| `NVIDIA_API_KEY` | NVIDIA NIM API key (free tier available) |

### Channel Integrations (optional)
| Variable | Description |
|---|---|
| `META_APP_ID` | Meta app ID for Instagram/Facebook |
| `META_APP_SECRET` | Meta app secret |
| `NEXT_PUBLIC_META_APP_ID` | Public Meta app ID (for OAuth) |
| `WHATSAPP_APP_SECRET` | WhatsApp webhook verification secret |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | WhatsApp webhook verify token |
| `SHOPIFY_API_KEY` | Shopify app key |
| `SHOPIFY_API_SECRET` | Shopify app secret (also used for token encryption) |
| `SHOPIFY_SCOPES` | Shopify OAuth scopes |

### Payments (optional)
| Variable | Description |
|---|---|
| `PAYMOB_API_KEY` | Paymob API key (Egypt payments) |
| `PAYMOB_INTEGRATION_ID` | Paymob integration ID |
| `PAYMOB_IFRAME_ID` | Paymob iframe ID |
| `PAYMOB_HMAC_SECRET` | Paymob webhook HMAC secret |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |

### Email (optional)
| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key for transactional email |

### Security (optional but recommended)
| Variable | Description |
|---|---|
| `TOTP_ENCRYPTION_KEY` | Dedicated key for encrypting 2FA secrets |
| `ADMIN_SECRET_KEY` | Admin API key for server-to-server calls |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g. https://sellora-ruby.vercel.app) |

### Rate Limiting (optional)
| Variable | Description |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL (for production rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |

## 🏗️ Architecture

```
src/
├── app/
│   ├── api/              # 208 API routes
│   │   ├── auth/         # Login, signup, 2FA, Meta OAuth
│   │   ├── automation/   # 5 automation suites (21 automations)
│   │   ├── webhooks/     # WhatsApp, IG, FB, Telegram, Stripe, Paymob, Shopify, Email
│   │   ├── messages/     # Send text, media, transcribe, recognize
│   │   ├── orders/       # Create, update, post-delivery
│   │   ├── payments/     # Paymob, Stripe
│   │   └── ... 
│   ├── dashboard/        # 30+ dashboard pages
│   ├── (auth)/           # Login, signup, forgot password
│   └── store/[slug]/     # Public storefront
├── lib/
│   ├── ai/               # AI providers, tools, bot, agents, router
│   ├── channels/         # Meta, WhatsApp, Telegram processors
│   ├── automation/       # Automation helpers
│   └── ...
└── supabase/
    └── migrations/       # 56 SQL migrations
```

## 🔌 Channel Setup

### WhatsApp
1. Go to https://developers.facebook.com → create app
2. Add WhatsApp product → get Phone Number ID + Access Token
3. Set webhook URL: `https://your-app.vercel.app/api/webhooks/whatsapp`
4. Set verify token = `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
5. Subscribe to `messages` field

### Instagram / Facebook
1. Same Meta app → add Instagram Graph API / Messenger
2. Set webhook URL: `https://your-app.vercel.app/api/webhooks/instagram` (or `/facebook`)
3. Subscribe to `messages`, `messaging_postbacks`

### Telegram
1. Message @BotFather on Telegram → `/newbot`
2. Copy bot token
3. In Sellora: Settings → Channels → paste token → Connect

### Email
1. Configure email forwarding to: `https://your-app.vercel.app/api/webhooks/email`
2. In Sellora: Settings → Channels → enter email address → Enable

## ⏰ Cron Jobs

Vercel cron jobs run daily (Hobby plan compatible):

| Time (UTC) | Endpoint | Description |
|---|---|---|
| 0:00 | `/api/abandoned-carts/process-recovery` | Abandoned cart recovery |
| 1:00 | `/api/orders/process-post-delivery` | Post-delivery review requests |
| 2:00 | `/api/campaigns/process-scheduled` | Scheduled campaigns |
| 3:00 | `/api/subscriptions/process-scheduled` | Subscription processing |
| 4:00 | `/api/email-drip` | Email drip campaigns |
| 5:00 | `/api/automation/revenue-suite/process` | Revenue automations |
| 6:00 | `/api/automation/lifecycle-suite/process` | Lifecycle automations |
| 7:00 | `/api/automation/ai-suite/process` | AI automations |
| 9:00 | `/api/automation/ai-extension/process` | AI extension automations |
| 10:00 | `/api/automation/operational-suite/process` | Operational automations |
| Mon 8:00 | `/api/email/weekly-summary-cron` | Weekly summary email |

## 🧪 Testing

```bash
npm run test     # Run unit tests
npm run lint     # Run ESLint
```

## 📦 Tech Stack

- **Framework:** Next.js 16 / React 19
- **Database:** Supabase (PostgreSQL + RLS + Realtime + Storage)
- **AI:** Vercel AI SDK + Groq + Google Gemini + OpenAI + NVIDIA NIM
- **Payments:** Paymob (Egypt) + Stripe
- **Channels:** WhatsApp Business API, Instagram Graph API, Facebook Messenger, Telegram Bot API, Email
- **Animations:** Framer Motion, Three.js, GSAP
- **Mobile:** Capacitor (iOS/Android), PWA

## 🔒 Security

- Row-Level Security (RLS) on all 50+ tables
- HMAC webhook signature verification (Meta, Shopify, Stripe, Paymob)
- 2FA with TOTP (encrypted at rest)
- 12-tier rate limiting
- IDOR protection on all resource routes
- SAFE_ACCOUNT_FIELDS pattern (no token leakage to client)

## 📄 License

Proprietary — All rights reserved.
