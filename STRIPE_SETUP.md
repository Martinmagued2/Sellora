# Stripe Setup Guide — Sellora

## Step 1: Create Stripe Products + Prices

Go to https://dashboard.stripe.com/products and create 3 products:

### Product 1: Sellora Starter
- **Name**: Sellora Starter
- **Description**: 1 channel, 25 products, 50 AI replies/day
- **Pricing**:
  - Monthly: $32 USD / month → copy the `price_XXX` ID
  - Annual: $384 USD / year → copy the `price_XXX` ID

### Product 2: Sellora Professional
- **Name**: Sellora Professional
- **Description**: 2 channels, unlimited products, 500 AI replies/day
- **Pricing**:
  - Monthly: $80 USD / month → copy the `price_XXX` ID
  - Annual: $960 USD / year → copy the `price_XXX` ID

### Product 3: Sellora Business
- **Name**: Sellora Business
- **Description**: All channels, unlimited everything, unlimited AI
- **Pricing**:
  - Monthly: $193 USD / month → copy the `price_XXX` ID
  - Annual: $2316 USD / year → copy the `price_XXX` ID

## Step 2: Set Vercel Environment Variables

Go to https://vercel.com/martins-projects-dcc6200e/sellora/settings/environment-variables

Add these 6 env vars (check Production + Preview):

```
STRIPE_SECRET_KEY=sk_live_XXXXX (or sk_test_ for test mode)
STRIPE_STARTER_MONTHLY_PRICE_ID=price_XXXXX
STRIPE_STARTER_ANNUAL_PRICE_ID=price_XXXXX
STRIPE_PRO_MONTHLY_PRICE_ID=price_XXXXX
STRIPE_PRO_ANNUAL_PRICE_ID=price_XXXXX
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_XXXXX
STRIPE_BUSINESS_ANNUAL_PRICE_ID=price_XXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXX
```

## Step 3: Set up Stripe Webhook

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. URL: `https://sellorachat.com/api/webhooks/stripe`
4. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the "Signing secret" (starts with `whsec_`)
7. Set it as `STRIPE_WEBHOOK_SECRET` in Vercel

## Step 4: Redeploy

After setting all env vars, redeploy on Vercel.

## Step 5: Test

1. Go to `/dashboard/billing`
2. Click "Upgrade" on a plan
3. Should redirect to Stripe Checkout
4. Use Stripe test card: `4242 4242 4242 4242` (any expiry, any CVC)
5. After payment, your plan should update automatically

## For Egyptian customers (Paymob)

Paymob is already configured for EGP payments. The `PLAN_PRICES` object in `/api/payments/create-subscription/route.js` handles the amounts. No Stripe needed for domestic Egyptian customers.

Stripe is for **international customers** who want to pay in USD.
