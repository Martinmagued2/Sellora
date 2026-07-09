/**
 * POST /api/orders/verify-payment-screenshot
 * Body: { orderId, imageUrl }
 *
 * Uses VLM (vision AI) to scan a payment screenshot (InstaPay, Vodafone Cash, etc.)
 * Extracts: transaction reference, amount paid, sender phone, date
 * Cross-checks amount against order total
 * Updates order with OCR result
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { canAccessAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin)
    _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { orderId, imageUrl } = await req.json();
    if (!orderId || !imageUrl) {
      return NextResponse.json({ error: "orderId and imageUrl required" }, { status: 400 });
    }

    const db = admin();

    // Get the order
    const { data: order, error: orderErr } = await db
      .from("orders")
      .select("id, account_id, total, currency, order_number, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify access
    const hasAccess = await canAccessAccount(user, order.account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use ZAI VLM to analyze the payment screenshot
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const prompt = `You are a payment verification assistant. Analyze this payment screenshot (could be InstaPay, Vodafone Cash, Etisalat Cash, bank transfer, or any Egyptian/MENA payment app).

Extract the following information:
1. Transaction Reference Number (look for #REF, transaction ID, reference number, process number)
2. Amount Paid (the exact amount transferred)
3. Sender phone/account (if visible)
4. Recipient name/account (if visible)
5. Date/time of transfer (if visible)
6. Payment method/app name (InstaPay, Vodafone Cash, etc.)

Return ONLY a JSON object with this exact format:
{
  "transaction_ref": "string or null",
  "amount": "number or null",
  "sender_phone": "string or null",
  "recipient": "string or null",
  "date": "string or null",
  "payment_method": "string or null",
  "confidence": "high|medium|low",
  "notes": "any observations"
}

If the image is not a payment screenshot, return: {"error": "not_a_payment_screenshot"}`;

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      thinking: { type: "disabled" },
    });

    const content = response.choices[0]?.message?.content || "";

    // Parse the JSON response
    let ocrResult;
    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      ocrResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "parse_failed", raw: content };
    } catch (e) {
      ocrResult = { error: "parse_failed", raw: content };
    }

    // Cross-check amount against order total
    let verificationStatus = "pending";
    let amountMatch = false;

    if (ocrResult.amount && !ocrResult.error) {
      const extractedAmount = parseFloat(String(ocrResult.amount).replace(/[^\d.]/g, ""));
      const orderTotal = parseFloat(order.total);

      if (!isNaN(extractedAmount) && !isNaN(orderTotal)) {
        // Allow small floating-point tolerance
        amountMatch = Math.abs(extractedAmount - orderTotal) < 1;
        verificationStatus = amountMatch ? "verified" : "mismatch";
      }
    }

    const result = {
      ...ocrResult,
      order_total: order.total,
      currency: order.currency,
      amount_match: amountMatch,
      verification_status: verificationStatus,
      verified_at: new Date().toISOString(),
      verified_by: user.id,
    };

    // Update order
    await db.from("orders").update({
      payment_screenshot_url: imageUrl,
      payment_ocr_result: result,
      payment_verified_by_ocr: verificationStatus === "verified",
      payment_verified_at: verificationStatus === "verified" ? new Date().toISOString() : null,
    }).eq("id", orderId);

    // If verified, optionally update payment status
    if (verificationStatus === "verified") {
      await db.from("orders").update({
        payment_status: "paid",
      }).eq("id", orderId);
    }

    return NextResponse.json({ success: true, result });
  } catch (e) {
    console.error("[VERIFY-PAYMENT] error:", e);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}
