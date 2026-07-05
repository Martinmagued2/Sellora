import { createClient } from "@/lib/supabase/server";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Brand colors
const COLORS = {
  primary: [108, 92, 231],    // #6c5ce7
  secondary: [0, 210, 255],   // #00d2ff
  green: [0, 230, 118],       // #00e676
  orange: [255, 145, 0],      // #ff9100
  red: [255, 82, 82],         // #ff5252
  dark: [15, 15, 25],         // #0f0f19
  text: [60, 60, 80],         // #3c3c50
  textLight: [120, 120, 150], // #787896
  bg: [245, 245, 250],        // #f5f5fa
  white: [255, 255, 255],
};

function drawBarChart(doc, data, x, y, width, height, title) {
  if (!data || data.length === 0) return;

  // Title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(title, x, y - 5);

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.min(30, (width - 20) / data.length - 4);
  const chartTop = y;
  const chartBottom = y + height;

  // Y-axis gridlines
  doc.setDrawColor(230, 230, 240);
  doc.setLineWidth(0.3);
  for (let i = 0; i <= 4; i++) {
    const lineY = chartTop + (height * i) / 4;
    doc.line(x, lineY, x + width, lineY);
    const val = Math.round(maxVal * (1 - i / 4));
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textLight);
    doc.text(String(val), x - 5, lineY + 2, { align: "right" });
  }

  // Bars
  data.forEach((item, i) => {
    const barHeight = (item.value / maxVal) * height;
    const barX = x + 15 + i * (barWidth + 4);
    const barY = chartBottom - barHeight;

    // Gradient-like effect with two rectangles
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(barX, barY, barWidth, barHeight, 2, 2, "F");

    // Lighter top portion
    doc.setFillColor(...COLORS.secondary);
    doc.roundedRect(barX, barY, barWidth, Math.min(barHeight * 0.3, 10), 2, 2, "F");

    // Value label on top
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(String(item.value), barX + barWidth / 2, barY - 3, { align: "center" });

    // X-axis label
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textLight);
    doc.text(item.label, barX + barWidth / 2, chartBottom + 8, {
      align: "center",
      maxWidth: barWidth + 4,
    });
  });
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { dateRange = "30d", reportType = "overview" } = body;

    // Fetch account info
    const { data: account } = await supabase
      .from("accounts")
      .select("business_name, email")
      .eq("id", user.id)
      .single();

    const businessName = account?.business_name || account?.email || "My Store";

    // Fetch analytics data
    const [ordersRes, customersRes, convsRes] = await Promise.all([
      supabase.from("orders").select("total, payment_status, created_at, status, channel, items").eq("account_id", user.id).order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name, total_orders, total_spent, channel").eq("account_id", user.id).order("total_spent", { ascending: false }).limit(10),
      supabase.from("conversations").select("id, status, channel, converted, created_at").eq("account_id", user.id),
    ]);

    const orders = ordersRes.data || [];
    const customers = customersRes.data || [];
    const conversations = convsRes.data || [];

    // Calculate stats
    const paidOrders = orders.filter((o) => o.payment_status === "paid");
    const revenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const avgOrderValue = paidOrders.length > 0 ? Math.round(revenue / paidOrders.length) : 0;
    const conversionRate = conversations.length > 0
      ? ((conversations.filter((c) => c.converted).length / conversations.length) * 100).toFixed(1)
      : 0;

    // Revenue by channel
    const channelRevenue = {};
    paidOrders.forEach((o) => {
      const ch = o.channel || "unknown";
      channelRevenue[ch] = (channelRevenue[ch] || 0) + (o.total || 0);
    });

    // Top products
    const productRevenue = {};
    paidOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const name = item.name || "Unknown";
        productRevenue[name] = (productRevenue[name] || 0) + (item.price || 0) * (item.qty || 1);
      });
    });
    const topProducts = Object.entries(productRevenue)
      .map(([name, rev]) => ({ name, revenue: rev }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Orders by status
    const statusCounts = {};
    orders.forEach((o) => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });

    // Daily revenue (last 14 days)
    const dailyRevenue = {};
    paidOrders.forEach((o) => {
      const day = new Date(o.created_at).toISOString().split("T")[0];
      dailyRevenue[day] = (dailyRevenue[day] || 0) + (o.total || 0);
    });
    const last14Days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      last14Days.push({
        label: key.slice(5),
        value: dailyRevenue[key] || 0,
      });
    }

    // ─── Create PDF ───
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPos = 0;

    // ─── COVER PAGE ───
    // Background gradient effect
    doc.setFillColor(...COLORS.dark);
    doc.rect(0, 0, pageWidth, 160, "F");

    // Accent bar
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 155, pageWidth, 5, "F");

    // Company name
    doc.setFontSize(36);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.white);
    doc.text("Sellora", margin, 60);

    // Report title
    doc.setFontSize(22);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.secondary);
    doc.text("Analytics Report", margin, 80);

    // Business name
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.white);
    doc.text(businessName, margin, 100);

    // Date range
    const rangeLabel = dateRange === "all" ? "All Time" : `Last ${dateRange.toUpperCase()}`;
    const reportTypeLabel = reportType === "sales" ? "Sales Report" : reportType === "customers" ? "Customer Report" : "Overview Report";
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.textLight);
    doc.text(`${reportTypeLabel} · ${rangeLabel}`, margin, 115);

    // Generated date
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin, 135);

    // Bottom info section
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.text("Confidential — For internal use only", margin, 175);

    // ─── KPI SUMMARY PAGE ───
    doc.addPage();
    yPos = 20;

    // Section header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text("Key Performance Indicators", margin, yPos);
    yPos += 12;

    // KPI boxes
    const kpis = [
      { label: "Total Revenue", value: `${revenue.toLocaleString()} EGP`, color: COLORS.green },
      { label: "Total Orders", value: String(orders.length), color: COLORS.primary },
      { label: "Paid Orders", value: String(paidOrders.length), color: COLORS.secondary },
      { label: "Avg Order Value", value: `${avgOrderValue.toLocaleString()} EGP`, color: COLORS.orange },
      { label: "Conversion Rate", value: `${conversionRate}%`, color: COLORS.primary },
      { label: "Total Customers", value: String(customers.length), color: COLORS.green },
    ];

    const kpiBoxWidth = (contentWidth - 10) / 3;
    const kpiBoxHeight = 28;
    kpis.forEach((kpi, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const boxX = margin + col * (kpiBoxWidth + 5);
      const boxY = yPos + row * (kpiBoxHeight + 5);

      // Box background
      doc.setFillColor(...COLORS.bg);
      doc.roundedRect(boxX, boxY, kpiBoxWidth, kpiBoxHeight, 3, 3, "F");

      // Accent bar at top
      doc.setFillColor(...kpi.color);
      doc.rect(boxX, boxY, kpiBoxWidth, 2, "F");

      // Value
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.text);
      doc.text(kpi.value, boxX + 5, boxY + 14);

      // Label
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.textLight);
      doc.text(kpi.label, boxX + 5, boxY + 22);
    });

    yPos += Math.ceil(kpis.length / 3) * (kpiBoxHeight + 5) + 15;

    // ─── REVENUE CHART ───
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text("Revenue Overview", margin, yPos);
    yPos += 8;

    if (last14Days.length > 0 && last14Days.some((d) => d.value > 0)) {
      drawBarChart(doc, last14Days, margin, yPos, contentWidth, 50, "Daily Revenue (Last 14 Days)");
      yPos += 70;
    } else {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.textLight);
      doc.text("No revenue data available for the selected period.", margin, yPos + 5);
      yPos += 20;
    }

    // ─── TOP PRODUCTS TABLE ───
    if (topProducts.length > 0) {
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.primary);
      doc.text("Top Products", margin, yPos);
      yPos += 5;

      doc.autoTable({
        startY: yPos,
        head: [["#", "Product Name", "Revenue (EGP)"]],
        body: topProducts.map((p, i) => [
          String(i + 1),
          p.name.length > 35 ? p.name.substring(0, 35) + "..." : p.name,
          p.revenue.toLocaleString(),
        ]),
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 9,
          cellPadding: 3,
          textColor: COLORS.text,
        },
        headStyles: {
          fillColor: COLORS.primary,
          textColor: COLORS.white,
          fontStyle: "bold",
          fontSize: 8,
        },
        alternateRowStyles: {
          fillColor: COLORS.bg,
        },
        theme: "plain",
      });

      yPos = doc.lastAutoTable.finalY + 15;
    }

    // ─── CUSTOMER STATISTICS ───
    if (reportType === "overview" || reportType === "customers") {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.primary);
      doc.text("Customer Statistics", margin, yPos);
      yPos += 5;

      const topCustomersData = customers.slice(0, 10);
      if (topCustomersData.length > 0) {
        doc.autoTable({
          startY: yPos,
          head: [["#", "Customer Name", "Total Orders", "Total Spent (EGP)", "Channel"]],
          body: topCustomersData.map((c, i) => [
            String(i + 1),
            c.name || "Unknown",
            String(c.total_orders || 0),
            (c.total_spent || 0).toLocaleString(),
            c.channel || "—",
          ]),
          margin: { left: margin, right: margin },
          styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: COLORS.text,
          },
          headStyles: {
            fillColor: COLORS.primary,
            textColor: COLORS.white,
            fontStyle: "bold",
            fontSize: 8,
          },
          alternateRowStyles: {
            fillColor: COLORS.bg,
          },
          theme: "plain",
        });

        yPos = doc.lastAutoTable.finalY + 15;
      }
    }

    // ─── ORDER BREAKDOWN BY STATUS ───
    if (reportType === "overview" || reportType === "sales") {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.primary);
      doc.text("Order Breakdown by Status", margin, yPos);
      yPos += 5;

      const statusEntries = Object.entries(statusCounts);
      if (statusEntries.length > 0) {
        doc.autoTable({
          startY: yPos,
          head: [["Status", "Count", "Percentage"]],
          body: statusEntries.map(([status, count]) => [
            status.charAt(0).toUpperCase() + status.slice(1),
            String(count),
            `${((count / orders.length) * 100).toFixed(1)}%`,
          ]),
          margin: { left: margin, right: margin },
          styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: COLORS.text,
          },
          headStyles: {
            fillColor: COLORS.primary,
            textColor: COLORS.white,
            fontStyle: "bold",
            fontSize: 8,
          },
          alternateRowStyles: {
            fillColor: COLORS.bg,
          },
          theme: "plain",
        });

        yPos = doc.lastAutoTable.finalY + 15;
      }

      // Channel Revenue
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.primary);
      doc.text("Revenue by Channel", margin, yPos);
      yPos += 5;

      const channelEntries = Object.entries(channelRevenue);
      if (channelEntries.length > 0) {
        doc.autoTable({
          startY: yPos,
          head: [["Channel", "Revenue (EGP)", "Percentage"]],
          body: channelEntries.map(([channel, rev]) => [
            channel.charAt(0).toUpperCase() + channel.slice(1),
            rev.toLocaleString(),
            `${((rev / revenue) * 100).toFixed(1)}%`,
          ]),
          margin: { left: margin, right: margin },
          styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: COLORS.text,
          },
          headStyles: {
            fillColor: COLORS.primary,
            textColor: COLORS.white,
            fontStyle: "bold",
            fontSize: 8,
          },
          alternateRowStyles: {
            fillColor: COLORS.bg,
          },
          theme: "plain",
        });
      }
    }

    // ─── FOOTER on each page ───
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.textLight);
      doc.text(
        `Sellora Analytics Report — ${businessName} — Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
    }

    // Generate PDF buffer
    const pdfBuffer = doc.output("arraybuffer");

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="sellora_report_${new Date().toISOString().split("T")[0]}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF export error:", err);
    return Response.json({ error: "Failed to generate PDF: " + err.message }, { status: 500 });
  }
}
