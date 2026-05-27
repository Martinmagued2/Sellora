import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper to fetch account context
const getAccountCurrency = async (accountId) => {
  const { data } = await supabase
    .from("accounts")
    .select("currency")
    .eq("id", accountId)
    .single();
  return data?.currency || "EGP";
};

export const createSalesTools = (accountId, customerId) => {
  return {
    search_products: tool({
      description: "Search the store's inventory for products by name or category. Use this when the customer asks what you sell or is looking for something specific.",
      parameters: z.object({
        query: z.string().optional().describe("Search term, product name, or category to look for (optional)"),
        search_query: z.string().optional().describe("Alternative search query parameter"),
      }),
      execute: async ({ query, search_query }) => {
        const finalQuery = query || search_query;
        let dbQuery = supabase
          .from("products")
          .select("id, name, description, price, stock, category")
          .eq("account_id", accountId)
          .eq("status", "active")
          .limit(10);

        if (finalQuery) {
          dbQuery = dbQuery.ilike("name", `%${finalQuery}%`);
        }

        const { data, error } = await dbQuery;

        if (error) {
          return { success: false, error: "Failed to search products" };
        }

        if (!data || data.length === 0) {
          return { success: true, message: "No products found matching that query.", products: [] };
        }

        const currency = await getAccountCurrency(accountId);
        return { success: true, currency, products: data };
      },
    }),

    check_stock: tool({
      description: "Check the exact stock level for a product using its ID or product name.",
      parameters: z.object({
        productId: z.string().optional().describe("The ID of the product to check"),
        product_id: z.string().optional().describe("Alternative product ID parameter"),
        name: z.string().optional().describe("The name of the product to check (alternative if ID is unknown)"),
        product_name: z.string().optional().describe("Alternative product name parameter"),
      }),
      execute: async ({ productId, product_id, name, product_name }) => {
        const finalId = productId || product_id;
        const finalName = name || product_name;

        let dbQuery = supabase
          .from("products")
          .select("id, name, stock")
          .eq("account_id", accountId);

        if (finalId) {
          dbQuery = dbQuery.eq("id", finalId);
        } else if (finalName) {
          dbQuery = dbQuery.ilike("name", `%${finalName}%`).limit(1);
        } else {
          return { success: false, error: "Either productId or product name is required" };
        }

        const { data, error } = await dbQuery;

        if (error || !data || data.length === 0) {
          return { success: false, error: "Product not found" };
        }

        const product = Array.isArray(data) ? data[0] : data;
        return { success: true, product: product.name, in_stock: product.stock > 0, stock_quantity: product.stock, productId: product.id };
      },
    }),

    calculate_cart_total: tool({
      description: "Calculate the total cost for a list of items before creating an order. Use this to confirm the total with the customer.",
      parameters: z.object({
        items: z.array(z.object({
          productId: z.string().optional().describe("Product ID"),
          product_id: z.string().optional().describe("Alternative product ID"),
          quantity: z.coerce.number().positive().describe("Quantity of items"),
        })),
      }),
      execute: async ({ items }) => {
        let total = 0;
        let lineItems = [];
        
        for (const item of items) {
          const finalId = item.productId || item.product_id;
          if (!finalId) continue;

          const { data } = await supabase
            .from("products")
            .select("id, name, price")
            .eq("id", finalId)
            .eq("account_id", accountId)
            .single();

          if (data) {
            const lineTotal = data.price * item.quantity;
            total += lineTotal;
            lineItems.push({
              name: data.name,
              price: data.price,
              quantity: item.quantity,
              subtotal: lineTotal
            });
          }
        }

        const currency = await getAccountCurrency(accountId);
        return { success: true, total, currency, items: lineItems };
      },
    }),

    create_order: tool({
      description: "Create a new order in the system for the customer. ONLY call this AFTER the customer has explicitly confirmed they want to order and agreed to the total price.",
      parameters: z.object({
        items: z.array(z.object({
          productId: z.string().optional().describe("Product ID"),
          product_id: z.string().optional().describe("Alternative product ID"),
          quantity: z.coerce.number().positive().describe("Quantity of items"),
        })),
        shippingAddress: z.string().optional().describe("Customer's shipping address"),
        shipping_address: z.string().optional().describe("Alternative shipping address parameter"),
        paymentMethod: z.enum(["cod", "vodafone_cash", "instapay"]).optional().describe("Payment method"),
        payment_method: z.enum(["cod", "vodafone_cash", "instapay"]).optional().describe("Alternative payment method parameter"),
      }),
      execute: async ({ items, shippingAddress, shipping_address, paymentMethod, payment_method }) => {
        const finalShippingAddress = shippingAddress || shipping_address || "Address needed";
        const finalPaymentMethod = paymentMethod || payment_method || "cod";

        // 1. Calculate total and format items for DB
        let total = 0;
        let dbItems = [];
        
        for (const item of items) {
          const finalId = item.productId || item.product_id;
          if (!finalId) continue;

          const { data } = await supabase
            .from("products")
            .select("id, name, price, stock")
            .eq("id", finalId)
            .eq("account_id", accountId)
            .single();

          if (data && data.stock >= item.quantity) {
            total += data.price * item.quantity;
            dbItems.push({
              product_id: data.id,
              name: data.name,
              price: data.price,
              qty: item.quantity
            });
          } else if (data) {
             return { success: false, error: `Insufficient stock for ${data.name}. Only ${data.stock} available.` };
          }
        }

        if (dbItems.length === 0) {
           return { success: false, error: "No valid items to order." };
        }

        // 2. Insert Order
        const { data: order, error } = await supabase
          .from("orders")
          .insert({
            account_id: accountId,
            customer_id: customerId,
            items: dbItems,
            subtotal: total,
            total: total,
            status: "pending",
            payment_method: finalPaymentMethod,
            shipping_address: finalShippingAddress,
            source: "ai_agent"
          })
          .select("order_number")
          .single();

        if (error) {
          return { success: false, error: "Failed to create order" };
        }

        return { 
          success: true, 
          message: "Order created successfully", 
          order_number: order.order_number,
          total
        };
      },
    }),
  };
};

export const createSupportTools = (accountId, customerId) => {
  return {
    get_customer_orders: tool({
      description: "Get all recent orders for the current customer.",
      parameters: z.object({}),
      execute: async () => {
        const { data, error } = await supabase
          .from("orders")
          .select("order_number, total, status, created_at, items")
          .eq("account_id", accountId)
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (error) return { success: false, error: "Failed to fetch orders" };
        return { success: true, orders: data };
      },
    }),

    get_order_status: tool({
      description: "Get the current status of a specific order by its order number.",
      parameters: z.object({
        orderNumber: z.string().optional().describe("The order number to check"),
        order_number: z.string().optional().describe("Alternative order number parameter"),
      }),
      execute: async ({ orderNumber, order_number }) => {
        const finalOrderNumber = orderNumber || order_number;
        if (!finalOrderNumber) return { success: false, error: "Order number is required" };

        const { data, error } = await supabase
          .from("orders")
          .select("status, total, created_at, tracking_number")
          .eq("account_id", accountId)
          .eq("order_number", finalOrderNumber)
          .single();

        if (error || !data) return { success: false, error: "Order not found" };
        return { success: true, order: data };
      },
    }),
  };
};
