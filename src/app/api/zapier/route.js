/** GET /api/zapier — Zapier app scaffold: returns available triggers + actions */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "Sellora",
    description: "Conversational commerce for MENA",
    triggers: [
      { type: "new_order", description: "Triggers when a new order is created" },
      { type: "new_message", description: "Triggers when a customer sends a message" },
      { type: "new_customer", description: "Triggers when a new customer is added" },
      { type: "order_paid", description: "Triggers when an order is paid" },
      { type: "low_stock", description: "Triggers when a product goes low stock" },
    ],
    actions: [
      { type: "create_product", description: "Create a new product" },
      { type: "send_message", description: "Send a message to a customer" },
      { type: "create_coupon", description: "Create a coupon code" },
      { type: "update_order_status", description: "Update an order's status" },
      { type: "add_customer_note", description: "Add a note to a customer" },
    ],
    note: "This is a scaffold. Full Zapier integration requires OAuth setup + webhook delivery at https://developer.zapier.com/",
  });
}
