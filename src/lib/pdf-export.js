"use client";

/**
 * Client-side PDF export using jsPDF.
 * Generates a branded analytics report PDF in the browser — no server needed.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = {
  primary: [108, 92, 231],
  secondary: [0, 210, 255],
  green: [0, 230, 118],
  orange: [255, 145, 0],
  red: [255, 82, 82],
  dark: [15, 15, 25],
  text: [60, 60, 80],
  textLight: [120, 120, 150],
  bg: [245, 245, 250],
  white: [255, 255, 255],
};

export async function generateAnalyticsPDF({ dateRange, reportType, analytics }) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const businessName = analytics.businessName || "My Store";
  const revenue = analytics.revenue || 0;
  const orders = analytics.orders || [];
  const paidOrders = orders.filter(o => o.payment_status === "paid");
  const avgOrderValue = paidOrders.length > 0 ? Math.round(revenue / paidOrders.length) : 0;
  const conversionRate = analytics.conversionRate || 0;
  const customers = analytics.customers || [];
  const topProducts = analytics.topProducts || [];

  // ─── COVER PAGE ───
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, pageWidth, 160, "F");

  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 155, pageWidth, 5, "F");

  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.white);
  doc.text("Sellora", margin, 60);

  doc.setFontSize(22);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);
  doc.text("Analytics Report", margin, 80);

  doc.setFontSize(16);
  doc.setTextColor(...COLORS.white);
  doc.text(businessName, margin, 100);

  const rangeLabel = dateRange === "all" ? "All Time" : `Last ${dateRange.toUpperCase()}`;
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textLight);
  doc.text(`${reportType === "sales" ? "Sales Report" : reportType === "customers" ? "Customer Report" : "Overview Report"} · ${rangeLabel}`, margin, 115);

  doc.setFontSize(9);
  doc.text(`Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin, 135);

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.text("Confidential — For internal use only", margin, 175);

  // ─── KPI PAGE ───
  doc.addPage();
  let yPos = 20;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text("Key Performance Indicators", margin, yPos);
  yPos += 12;

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

    doc.setFillColor(...COLORS.bg);
    doc.roundedRect(boxX, boxY, kpiBoxWidth, kpiBoxHeight, 3, 3, "F");
    doc.setFillColor(...kpi.color);
    doc.rect(boxX, boxY, kpiBoxWidth, 2, "F");

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(kpi.value, boxX + 5, boxY + 14);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textLight);
    doc.text(kpi.label, boxX + 5, boxY + 22);
  });

  yPos += Math.ceil(kpis.length / 3) * (kpiBoxHeight + 5) + 15;

  // ─── TOP PRODUCTS ───
  if (topProducts.length > 0) {
    if (yPos > 230) { doc.addPage(); yPos = 20; }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text("Top Products", margin, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [["#", "Product Name", "Revenue (EGP)"]],
      body: topProducts.map((p, i) => [
        String(i + 1),
        (p.name || "").slice(0, 35),
        (p.revenue || 0).toLocaleString(),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3, textColor: COLORS.text },
      headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.bg },
      theme: "plain",
    });

    yPos = doc.lastAutoTable.finalY + 15;
  }

  // ─── TOP CUSTOMERS ───
  if (customers.length > 0) {
    if (yPos > 220) { doc.addPage(); yPos = 20; }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text("Top Customers", margin, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [["#", "Customer", "Orders", "Spent (EGP)", "Channel"]],
      body: customers.slice(0, 10).map((c, i) => [
        String(i + 1),
        (c.name || "Unknown").slice(0, 25),
        String(c.total_orders || 0),
        (c.total_spent || 0).toLocaleString(),
        c.channel || "—",
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3, textColor: COLORS.text },
      headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.bg },
      theme: "plain",
    });

    yPos = doc.lastAutoTable.finalY + 15;
  }

  // ─── FOOTER ───
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

  // Download
  doc.save(`sellora_report_${new Date().toISOString().split('T')[0]}.pdf`);
}
