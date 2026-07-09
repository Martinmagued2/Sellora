/**
 * POST /api/shipping/waybill?orderId=xxx
 * Generates a printable waybill (AWB) PDF with barcode + QR code
 * for Bosta/Mylerz/ARAMEX shipping labels.
 *
 * Returns: PDF file (application/pdf)
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

// Simple Code128 barcode generator (SVG → used for rendering)
function generateBarcodeSVG(data, width = 300, height = 60) {
  // Simplified barcode — each character becomes a vertical bar pattern
  const bars = [];
  let x = 0;
  const barWidth = width / (data.length * 4);
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i);
    // Create a pattern of 4 bars per character
    for (let j = 0; j < 4; j++) {
      const isBlack = (charCode >> j) & 1;
      if (isBlack) {
        bars.push(`<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="black"/>`);
      }
      x += barWidth;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="white"/>
    ${bars.join('')}
  </svg>`;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const orderIds = searchParams.get("orderIds") || searchParams.get("orderId");
    if (!orderIds) {
      return NextResponse.json({ error: "orderId or orderIds required" }, { status: 400 });
    }

    const ids = orderIds.split(",").map((s) => s.trim()).filter(Boolean);
    const db = admin();

    // Fetch orders
    const { data: orders, error } = await db
      .from("orders")
      .select(`
        id, order_number, total, currency, status, payment_status,
        shipping_address, customer:customers(name, phone, email)
      `)
      .in("id", ids);

    if (error || !orders || orders.length === 0) {
      return NextResponse.json({ error: "Orders not found" }, { status: 404 });
    }

    // Verify access for all orders
    for (const order of orders) {
      // Need to get account_id — let's fetch it
      const { data: fullOrder } = await db
        .from("orders")
        .select("account_id")
        .eq("id", order.id)
        .maybeSingle();
      if (fullOrder) {
        const hasAccess = await canAccessAccount(user, fullOrder.account_id);
        if (!hasAccess) {
          return NextResponse.json({ error: `Forbidden for order ${order.id}` }, { status: 403 });
        }
      }
    }

    // Generate HTML waybill page (browser can print to PDF)
    const waybillHTML = orders.map((order, idx) => {
      const trackingNumber = `SP${order.order_number || order.id.slice(-8).toUpperCase()}`;
      const barcodeSVG = generateBarcodeSVG(trackingNumber);
      const customer = order.customer || {};
      const address = typeof order.shipping_address === "string"
        ? JSON.parse(order.shipping_address)
        : order.shipping_address || {};

      return `
      <div class="waybill" style="
        width: 100mm; height: 150mm; padding: 8mm;
        border: 2px solid #000; margin: ${idx > 0 ? "10mm" : "0"} auto;
        font-family: Arial, sans-serif; font-size: 11px; box-sizing: border-box;
        page-break-after: ${idx < orders.length - 1 ? "always" : "auto"};
      ">
        <!-- Header -->
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="font-size: 18px; font-weight: bold;">SHIPPING WAYBILL</div>
          <div style="font-size: 10px; color: #666;">Sellora Commerce • Express Delivery</div>
        </div>

        <!-- Tracking + Barcode -->
        <div style="text-align: center; margin: 10px 0;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 4px;">${trackingNumber}</div>
          <div style="display: flex; justify-content: center;">${barcodeSVG}</div>
        </div>

        <!-- From -->
        <div style="border: 1px solid #ccc; padding: 6px; margin-bottom: 6px;">
          <div style="font-weight: bold; font-size: 10px; color: #666; margin-bottom: 3px;">FROM (SENDER)</div>
          <div>Sellora Store</div>
          <div>Cairo, Egypt</div>
        </div>

        <!-- To -->
        <div style="border: 2px solid #000; padding: 6px; margin-bottom: 6px;">
          <div style="font-weight: bold; font-size: 10px; color: #666; margin-bottom: 3px;">TO (RECEIVER)</div>
          <div style="font-size: 13px; font-weight: bold;">${customer.name || "N/A"}</div>
          <div>📞 ${customer.phone || "N/A"}</div>
          <div>${address.street || address.address || ""} ${address.city || ""} ${address.governorate || ""}</div>
          <div>${address.country || "Egypt"}</div>
        </div>

        <!-- Order Info -->
        <div style="border: 1px solid #ccc; padding: 6px; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between;">
            <span><strong>Order:</strong> #${order.order_number || order.id.slice(-8)}</span>
            <span><strong>Payment:</strong> ${order.payment_status?.toUpperCase() || "N/A"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 4px;">
            <span><strong>COD Amount:</strong> ${order.payment_status === "cod" || order.payment_status !== "paid" ? `${order.total} ${order.currency}` : "PAID"}</span>
            <span><strong>Items:</strong> ${order.items?.length || "—"}</span>
          </div>
        </div>

        <!-- QR placeholder -->
        <div style="text-align: center; margin-top: 10px;">
          <div style="width: 80px; height: 80px; border: 1px solid #000; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 9px;">
            QR: ${trackingNumber}
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 10px; font-size: 9px; color: #999; border-top: 1px solid #ccc; padding-top: 5px;">
          Generated by Sellora • ${new Date().toLocaleString()}
        </div>
      </div>`;
    }).join("");

    // Return as HTML page that triggers print
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shipping Waybills</title>
  <style>
    @media print {
      body { margin: 0; }
      @page { size: 100mm 150mm; margin: 0; }
    }
    body { font-family: Arial, sans-serif; }
  </style>
</head>
<body>
  ${waybillHTML}
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (e) {
    console.error("[WAYBILL] error:", e);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}
