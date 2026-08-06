/**
 * GET  /api/invoices — list invoices
 * POST /api/invoices — create invoice (generates sequential invoice number + PDF)
 *
 * Invoice number format: INV-{YYYY}-{000001}
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

function generateInvoiceNumber(existing) {
  const year = new Date().getFullYear();
  const count = (existing || 0) + 1;
  return `INV-${year}-${String(count).padStart(6, "0")}`;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const db = admin();
    const { data: invoices, error } = await db
      .from("invoices")
      .select("*")
      .eq("account_id", effectiveAccountId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ invoices: invoices || [] });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const body = await req.json();
    const db = admin();

    // Generate sequential invoice number
    const { count } = await db
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("account_id", effectiveAccountId);

    const invoiceNumber = generateInvoiceNumber(count || 0);

    // Calculate totals
    const items = body.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity || 0), 0);
    const tax = body.tax || 0;
    const discount = body.discount || 0;
    const total = subtotal + tax - discount;

    // Fetch account for business name
    const { data: account } = await db
      .from("accounts")
      .select("business_name, email, country, currency")
      .eq("id", effectiveAccountId)
      .maybeSingle();

    // Generate PDF
    const pdfBuffer = generateInvoicePDF({
      invoiceNumber,
      businessName: account?.business_name || "Store",
      businessEmail: account?.email,
      customerName: body.customer_name || "Customer",
      customerEmail: body.customer_email,
      customerPhone: body.customer_phone,
      items,
      subtotal,
      tax,
      discount,
      total,
      currency: account?.currency || body.currency || "EGP",
      dueDate: body.due_date,
      notes: body.notes,
      createdAt: new Date().toISOString(),
    });

    // Upload PDF to storage
    const fileName = `invoices/${effectiveAccountId}/${invoiceNumber}.pdf`;
    const { error: uploadErr } = await db.storage
      .from("invoices")
      .upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: true });

    let pdfUrl = null;
    if (!uploadErr) {
      const { data: urlData } = db.storage.from("invoices").getPublicUrl(fileName);
      pdfUrl = urlData?.publicUrl;
    }

    // Insert invoice record
    const { data: invoice, error: insertErr } = await db
      .from("invoices")
      .insert({
        account_id: effectiveAccountId,
        invoice_number: invoiceNumber,
        order_id: body.order_id || null,
        customer_id: body.customer_id || null,
        customer_name: body.customer_name,
        customer_email: body.customer_email,
        customer_phone: body.customer_phone,
        items,
        subtotal,
        tax,
        discount,
        total,
        currency: account?.currency || body.currency || "EGP",
        status: "pending",
        due_date: body.due_date || null,
        pdf_url: pdfUrl,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ invoice, pdf_url: pdfUrl });
  } catch (e) {
    console.error("[INVOICES] POST error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * Generate a simple PDF invoice using raw PDF construction.
 * This is a minimal PDF — no external library needed.
 */
function generateInvoicePDF(data) {
  const { invoiceNumber, businessName, businessEmail, customerName, customerEmail, items, subtotal, tax, discount, total, currency, dueDate, notes, createdAt } = data;

  const dateStr = new Date(createdAt).toLocaleDateString();
  const dueStr = dueDate ? new Date(dueDate).toLocaleDateString() : "N/A";

  // Build PDF content as text
  let content = `INVOICE\n\n`;
  content += `Invoice #: ${invoiceNumber}\n`;
  content += `Date: ${dateStr}\n`;
  content += `Due: ${dueStr}\n\n`;
  content += `From:\n${businessName}\n${businessEmail || ""}\n\n`;
  content += `To:\n${customerName}\n${customerEmail || ""}\n\n`;
  content += `Items:\n`;
  items.forEach((item, i) => {
    content += `  ${i + 1}. ${item.name || "Item"} x${item.quantity || 1} - ${(item.price * item.quantity).toFixed(2)} ${currency}\n`;
  });
  content += `\nSubtotal: ${subtotal.toFixed(2)} ${currency}\n`;
  if (tax > 0) content += `Tax: ${tax.toFixed(2)} ${currency}\n`;
  if (discount > 0) content += `Discount: -${discount.toFixed(2)} ${currency}\n`;
  content += `Total: ${total.toFixed(2)} ${currency}\n`;
  if (notes) content += `\nNotes: ${notes}\n`;

  // Minimal PDF structure
  const lines = content.split("\n");
  const pdfLines = lines.map(l => `(${l.replace(/[()\\]/g, "\\$&")}) Tj`).join(" Td 0 TD ");

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${pdfLines.length + 30} >>
stream
BT /F1 10 Tf 50 750 Td ${pdfLines} ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000${(300 + pdfLines.length).toString().padStart(7, "0")} 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + pdfLines.length}
%%EOF`;

  return Buffer.from(pdf, "utf-8");
}
