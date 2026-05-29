/**
 * Paymob Payment Integration Library
 * Handles order-level payments (customer checkout) via Paymob Accept API
 */

const PAYMOB_BASE = "https://accept.paymob.com/api";

/**
 * Step 1: Authenticate with Paymob API
 * @returns {Promise<string>} Auth token
 */
export async function authenticate() {
  const apiKey = process.env.PAYMOB_API_KEY;
  if (!apiKey) throw new Error("PAYMOB_API_KEY not configured");

  const res = await fetch(`${PAYMOB_BASE}/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });

  const data = await res.json();
  if (!data.token) {
    console.error("[PAYMOB] Auth failed:", data);
    throw new Error("Paymob authentication failed");
  }

  return data.token;
}

/**
 * Step 2: Register an order with Paymob
 * @param {Object} params
 * @param {string} params.authToken - Paymob auth token
 * @param {number} params.amountCents - Amount in cents (e.g., 10000 = 100 EGP)
 * @param {string} params.merchantOrderId - Unique order reference
 * @param {Array} params.items - Order items for Paymob
 * @returns {Promise<{id: number}>} Paymob order ID
 */
export async function registerOrder({ authToken, amountCents, merchantOrderId, items }) {
  const res = await fetch(`${PAYMOB_BASE}/ecommerce/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: "false",
      amount_cents: amountCents.toString(),
      currency: "EGP",
      merchant_order_id: merchantOrderId,
      items: items.map((item) => ({
        name: item.name?.slice(0, 50) || "Product",
        amount_cents: (Math.round(item.price * 100)).toString(),
        description: item.name?.slice(0, 100) || "Product",
        quantity: item.qty.toString(),
      })),
    }),
  });

  const data = await res.json();
  if (!data.id) {
    console.error("[PAYMOB] Order registration failed:", data);
    throw new Error("Paymob order registration failed");
  }

  return data;
}

/**
 * Step 3: Generate payment key for iframe checkout
 * @param {Object} params
 * @param {string} params.authToken - Paymob auth token
 * @param {number} params.amountCents - Amount in cents
 * @param {number} params.paymobOrderId - Paymob order ID from step 2
 * @param {Object} params.billingData - Customer billing info
 * @returns {Promise<string>} Payment key token
 */
export async function generatePaymentKey({ authToken, amountCents, paymobOrderId, billingData }) {
  const integrationId = process.env.PAYMOB_INTEGRATION_ID;
  if (!integrationId) throw new Error("PAYMOB_INTEGRATION_ID not configured");

  const res = await fetch(`${PAYMOB_BASE}/acceptance/payment_keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: amountCents.toString(),
      expiration: 3600, // 1 hour
      order_id: paymobOrderId,
      billing_data: {
        apartment: billingData.apartment || "NA",
        email: billingData.email || "customer@sellora.com",
        floor: billingData.floor || "NA",
        first_name: billingData.firstName || "Customer",
        street: billingData.street || "NA",
        building: billingData.building || "NA",
        phone_number: billingData.phone || "NA",
        shipping_method: "NA",
        postal_code: billingData.postalCode || "NA",
        city: billingData.city || "Cairo",
        country: billingData.country || "EG",
        last_name: billingData.lastName || "Customer",
        state: billingData.state || "NA",
      },
      currency: "EGP",
      integration_id: integrationId,
    }),
  });

  const data = await res.json();
  if (!data.token) {
    console.error("[PAYMOB] Payment key generation failed:", data);
    throw new Error("Paymob payment key generation failed");
  }

  return data.token;
}

/**
 * Full checkout flow: Auth → Order → Payment Key → Iframe URL
 * @param {Object} params
 * @param {number} params.amountCents - Total amount in cents
 * @param {string} params.merchantOrderId - Unique reference (e.g., "ord_xxx_timestamp")
 * @param {Array} params.items - Order items
 * @param {Object} params.billingData - Customer billing data
 * @returns {Promise<{checkoutUrl: string, paymobOrderId: number}>} Checkout iframe URL
 */
export async function createCheckout({ amountCents, merchantOrderId, items, billingData }) {
  // Step 1: Authenticate
  const authToken = await authenticate();

  // Step 2: Register order
  const orderData = await registerOrder({ authToken, amountCents, merchantOrderId, items });

  // Step 3: Generate payment key
  const paymentKey = await generatePaymentKey({
    authToken,
    amountCents,
    paymobOrderId: orderData.id,
    billingData,
  });

  // Step 4: Construct iframe URL
  const iframeId = process.env.PAYMOB_IFRAME_ID;
  if (!iframeId) throw new Error("PAYMOB_IFRAME_ID not configured");

  const checkoutUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;

  return {
    checkoutUrl,
    paymobOrderId: orderData.id,
  };
}

/**
 * Verify Paymob HMAC signature for webhook callbacks
 * @param {Object} obj - Transaction object from Paymob
 * @param {string} hmacSecret - PAYMOB_HMAC_SECRET
 * @param {string} providedHmac - HMAC from query parameter
 * @returns {boolean} Whether signature is valid
 */
export function verifyHmac(obj, hmacSecret, providedHmac) {
  const crypto = require("crypto");

  const fields = [
    "amount_cents", "created_at", "currency", "error_occured",
    "has_parent_transaction", "id", "integration_id", "is_3d_secure",
    "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
    "is_voided", "order.id", "owner", "pending",
    "source_data.pan", "source_data.sub_type", "source_data.type", "success",
  ];

  let concatenatedString = "";
  for (const field of fields) {
    if (field === "order.id") {
      concatenatedString += obj.order?.id || "";
    } else if (field.startsWith("source_data.")) {
      const subField = field.split(".")[1];
      concatenatedString += obj.source_data?.[subField] || "";
    } else {
      let val = obj[field];
      if (val === true) val = "true";
      if (val === false) val = "false";
      concatenatedString += val || "";
    }
  }

  const calculated = crypto.createHmac("sha512", hmacSecret).update(concatenatedString).digest("hex");
  return calculated === providedHmac;
}
