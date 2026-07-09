/**
 * AI Cart Tools
 *
 * Tools the AI agent uses to manage multi-item carts during chat conversations.
 * These supplement createSalesTools — they should be merged into the agent's
 * toolset when the plan supports agent_tools (Pro+).
 *
 * Flow:
 *   1. AI calls get_or_create_cart → returns cart_id
 *   2. AI calls add_to_cart for each product the customer wants
 *   3. AI calls get_cart to show the customer their cart + total
 *   4. Customer confirms → AI calls checkout_cart → order is created
 *
 * These tools are gated by plan_limits.agent_tools.
 */

import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

function recomputeTotals(items, discount = 0) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * i.qty, 0);
  const total = Math.max(0, subtotal - discount);
  return { subtotal, discount, total };
}

async function persistCart(cart) {
  const supabase = getSupabase();
  const totals = recomputeTotals(cart.items || [], Number(cart.discount) || 0);
  const { data, error } = await supabase
    .from("carts")
    .update({
      items: cart.items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cart.id)
    .select("*")
    .single();
  return { cart: data, error };
}

export const createCartTools = (accountId, customerId, conversationId = null) => {
  return {
    get_or_create_cart: tool({
      description:
        "Get the customer's open shopping cart for this conversation, or create one if it doesn't exist. " +
        "Returns the cart_id and current items. Call this BEFORE adding items to a cart. " +
        "Use this when a customer wants to buy multiple products or build up an order over the conversation.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const supabase = getSupabase();
          let cart = null;

          if (conversationId) {
            const { data } = await supabase
              .from("carts")
              .select("*")
              .eq("account_id", accountId)
              .eq("conversation_id", conversationId)
              .eq("status", "open")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            cart = data;
          }

          if (!cart && customerId) {
            const { data } = await supabase
              .from("carts")
              .select("*")
              .eq("account_id", accountId)
              .eq("customer_id", customerId)
              .eq("status", "open")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            cart = data;
          }

          if (!cart) {
            const insertPayload = {
              account_id: accountId,
              status: "open",
              items: [],
              subtotal: 0,
              discount: 0,
              total: 0,
            };
            if (conversationId) insertPayload.conversation_id = conversationId;
            if (customerId) insertPayload.customer_id = customerId;

            const { data: newCart, error } = await supabase
              .from("carts")
              .insert(insertPayload)
              .select("*")
              .single();
            if (error) {
              return { success: false, error: "Could not create cart" };
            }
            cart = newCart;
          }

          return {
            success: true,
            cart_id: cart.id,
            items: cart.items || [],
            subtotal: cart.subtotal,
            discount: cart.discount,
            total: cart.total,
            currency: cart.currency || "EGP",
            item_count: (cart.items || []).reduce((s, i) => s + i.qty, 0),
          };
        } catch (err) {
          console.error("[CART-TOOL] get_or_create_cart error:", err.message);
          return { success: false, error: err.message };
        }
      },
    }),

    add_to_cart: tool({
      description:
        "Add a product to the customer's cart. If the same product is already in the cart, the quantity is increased. " +
        "Use this when a customer says 'I want to add X', 'also add Y', 'give me 2 of those', etc. " +
        "ALWAYS pass the exact product_id from a previous search_products or recommend_products call.",
      inputSchema: z.object({
        product_id: z.string().uuid().describe("The UUID of the product to add"),
        qty: z.number().int().min(1).default(1).describe("Quantity to add (default 1)"),
        variant: z.string().optional().describe("Variant label if applicable (e.g. 'Red', 'Large')"),
      }),
      execute: async ({ product_id, qty, variant }) => {
        try {
          const supabase = getSupabase();

          // Look up product
          const { data: product, error: prodErr } = await supabase
            .from("products")
            .select("id, name, price, stock, variants, status")
            .eq("id", product_id)
            .eq("account_id", accountId)
            .single();
          if (prodErr || !product) {
            return { success: false, error: "Product not found" };
          }
          if (product.status !== "active") {
            return { success: false, error: "Product is no longer available" };
          }
          if (Number(product.stock) < qty) {
            return {
              success: false,
              error: `Only ${product.stock} in stock (requested ${qty})`,
              available_stock: Number(product.stock),
            };
          }

          // Find or create the cart
          let cart = null;
          if (conversationId) {
            const { data } = await supabase
              .from("carts")
              .select("*")
              .eq("account_id", accountId)
              .eq("conversation_id", conversationId)
              .eq("status", "open")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            cart = data;
          }
          if (!cart) {
            const insertPayload = {
              account_id: accountId,
              status: "open",
              items: [],
              subtotal: 0,
              discount: 0,
              total: 0,
            };
            if (conversationId) insertPayload.conversation_id = conversationId;
            if (customerId) insertPayload.customer_id = customerId;
            const { data: newCart, error } = await supabase
              .from("carts")
              .insert(insertPayload)
              .select("*")
              .single();
            if (error) return { success: false, error: "Could not create cart" };
            cart = newCart;
          }

          // Compute unit price (variant override)
          let unitPrice = Number(product.price);
          let variantLabel = null;
          if (variant && Array.isArray(product.variants)) {
            const v = product.variants.find((x) => x.label === variant || x.id === variant);
            if (v) {
              unitPrice = Number(v.price || product.price);
              variantLabel = v.label || v.id;
            }
          }

          // Merge or push
          const items = cart.items || [];
          const existingIdx = items.findIndex(
            (i) => i.product_id === product_id && (i.variant || null) === (variantLabel || null)
          );
          if (existingIdx >= 0) {
            items[existingIdx].qty += qty;
          } else {
            items.push({
              item_id: crypto.randomUUID(),
              product_id,
              name: product.name,
              price: unitPrice,
              qty,
              variant: variantLabel,
              added_at: new Date().toISOString(),
            });
          }
          cart.items = items;
          const { cart: updated, error } = await persistCart(cart);
          if (error) return { success: false, error: "Failed to update cart" };

          return {
            success: true,
            cart_id: updated.id,
            items: updated.items,
            subtotal: updated.subtotal,
            total: updated.total,
            item_count: (updated.items || []).reduce((s, i) => s + i.qty, 0),
            added: { name: product.name, qty, price: unitPrice, variant: variantLabel },
          };
        } catch (err) {
          console.error("[CART-TOOL] add_to_cart error:", err.message);
          return { success: false, error: err.message };
        }
      },
    }),

    remove_from_cart: tool({
      description:
        "Remove a product from the customer's cart. Use this when a customer says 'remove X', 'take that out', 'I don't want that anymore'.",
      inputSchema: z.object({
        product_id: z.string().uuid().describe("The UUID of the product to remove"),
        variant: z.string().optional().describe("Variant label if applicable"),
      }),
      execute: async ({ product_id, variant }) => {
        try {
          const supabase = getSupabase();
          if (!conversationId) return { success: false, error: "No active cart" };

          const { data: cart } = await supabase
            .from("carts")
            .select("*")
            .eq("account_id", accountId)
            .eq("conversation_id", conversationId)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!cart) return { success: false, error: "No open cart" };

          const before = (cart.items || []).length;
          cart.items = (cart.items || []).filter(
            (i) => !(i.product_id === product_id && (i.variant || null) === (variant || null))
          );
          const after = cart.items.length;
          if (after === before) {
            return { success: false, error: "Item not in cart" };
          }
          const { cart: updated, error } = await persistCart(cart);
          if (error) return { success: false, error: "Failed to update cart" };

          return {
            success: true,
            cart_id: updated.id,
            items: updated.items,
            subtotal: updated.subtotal,
            total: updated.total,
            item_count: (updated.items || []).reduce((s, i) => s + i.qty, 0),
          };
        } catch (err) {
          return { success: false, error: err.message };
        }
      },
    }),

    get_cart: tool({
      description:
        "Show the customer their current cart — items, quantities, subtotal, and total. " +
        "Use this when a customer asks 'what's in my cart?', 'show me my order', or before asking them to confirm checkout.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const supabase = getSupabase();
          if (!conversationId) return { success: true, items: [], total: 0, message: "No active cart" };

          const { data: cart } = await supabase
            .from("carts")
            .select("*")
            .eq("account_id", accountId)
            .eq("conversation_id", conversationId)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!cart) {
            return { success: true, items: [], total: 0, message: "Your cart is empty" };
          }

          return {
            success: true,
            cart_id: cart.id,
            items: cart.items || [],
            subtotal: cart.subtotal,
            discount: cart.discount,
            total: cart.total,
            currency: cart.currency || "EGP",
            item_count: (cart.items || []).reduce((s, i) => s + i.qty, 0),
          };
        } catch (err) {
          return { success: false, error: err.message };
        }
      },
    }),

    checkout_cart: tool({
      description:
        "Convert the customer's cart into a finalized order. ONLY call this AFTER the customer has explicitly confirmed they want to place the order and reviewed the total. " +
        "This decrements inventory and creates an order record. The order will be in 'pending' status until payment is confirmed.",
      inputSchema: z.object({
        shipping_address: z.string().optional().describe("Customer's shipping address if provided"),
        notes: z.string().optional().describe("Optional order notes"),
        payment_method: z.string().optional().describe("Payment method (e.g. 'cod', 'card', 'vodafone_cash')"),
      }),
      execute: async ({ shipping_address, notes, payment_method }) => {
        try {
          const supabase = getSupabase();
          if (!conversationId) return { success: false, error: "No active cart" };

          const { data: cart } = await supabase
            .from("carts")
            .select("*")
            .eq("account_id", accountId)
            .eq("conversation_id", conversationId)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!cart || !cart.items || cart.items.length === 0) {
            return { success: false, error: "Cart is empty" };
          }

          const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

          const { data: order, error: orderErr } = await supabase
            .from("orders")
            .insert({
              account_id: accountId,
              customer_id: cart.customer_id || customerId,
              order_number: orderNumber,
              items: cart.items,
              subtotal: cart.subtotal,
              shipping_cost: 0,
              total: cart.total,
              currency: cart.currency || "EGP",
              status: "pending",
              channel: "whatsapp",
              payment_method: payment_method || null,
              payment_status: "unpaid",
              shipping_address: shipping_address || null,
              notes: notes || null,
            })
            .select("*")
            .single();

          if (orderErr) {
            console.error("[CART-TOOL] order insert failed:", orderErr.message);
            return { success: false, error: "Failed to create order" };
          }

          // Mark cart converted
          await supabase
            .from("carts")
            .update({
              status: "converted",
              converted_order_id: order.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", cart.id);

          // Decrement stock
          for (const item of cart.items) {
            try {
              const { data: product } = await supabase
                .from("products")
                .select("stock")
                .eq("id", item.product_id)
                .single();
              if (product && Number(product.stock) >= item.qty) {
                await supabase
                  .from("products")
                  .update({ stock: Number(product.stock) - item.qty })
                  .eq("id", item.product_id);
              }
            } catch (e) { /* ignore stock errors */ }
          }

          return {
            success: true,
            order_id: order.id,
            order_number: orderNumber,
            total: cart.total,
            currency: cart.currency || "EGP",
            item_count: cart.items.reduce((s, i) => s + i.qty, 0),
            message: `Order ${orderNumber} created. Total: ${cart.currency || "EGP"} ${cart.total}.`,
          };
        } catch (err) {
          console.error("[CART-TOOL] checkout error:", err.message);
          return { success: false, error: err.message };
        }
      },
    }),
  };
};

/**
 * Customer Memory Tool
 * Lets the AI read and write structured preferences + free-form memory
 * for a customer. Examples:
 *   - "prefers cash on delivery"
 *   - "allergic to peanuts"
 *   - "speaks Arabic only"
 *   - "VIP — gets 15% off"
 */
export const createCustomerMemoryTools = (accountId, customerId) => {
  return {
    get_customer_preferences: tool({
      description:
        "Read the customer's stored preferences and AI memory. " +
        "Use this at the start of a conversation to personalize the interaction. " +
        "Returns structured preferences (e.g. prefers_cod, language) and any free-form notes the AI has saved about this customer.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!customerId) return { success: false, error: "No customer context" };
        try {
          const supabase = getSupabase();
          const { data: customer } = await supabase
            .from("customers")
            .select("preferences, ai_memory, vip, name, total_orders, lifetime_value")
            .eq("id", customerId)
            .eq("account_id", accountId)
            .single();
          if (!customer) return { success: false, error: "Customer not found" };

          return {
            success: true,
            preferences: customer.preferences || {},
            ai_memory: customer.ai_memory || "",
            vip: customer.vip || false,
            customer_name: customer.name,
            total_orders: customer.total_orders || 0,
            lifetime_value: customer.lifetime_value || 0,
          };
        } catch (err) {
          return { success: false, error: err.message };
        }
      },
    }),

    save_customer_preference: tool({
      description:
        "Save a structured preference for this customer. Use this when the customer mentions a durable preference " +
        "like 'I prefer cash on delivery', 'I only speak Arabic', 'I'm allergic to peanuts', 'My size is M'. " +
        "Common keys: prefers_cod (bool), language (string), allergies (array), size (string), preferred_payment (string), " +
        "vip (bool), delivery_notes (string). Set replace=true to overwrite the entire preferences object.",
      inputSchema: z.object({
        key: z.string().describe("The preference key, e.g. 'prefers_cod', 'language', 'allergies'"),
        value: z.any().describe("The preference value (string, number, boolean, or array)"),
      }),
      execute: async ({ key, value }) => {
        if (!customerId) return { success: false, error: "No customer context" };
        try {
          const supabase = getSupabase();
          const { data: customer } = await supabase
            .from("customers")
            .select("preferences")
            .eq("id", customerId)
            .eq("account_id", accountId)
            .single();
          if (!customer) return { success: false, error: "Customer not found" };

          const prefs = customer.preferences || {};
          prefs[key] = value;

          await supabase
            .from("customers")
            .update({ preferences: prefs, updated_at: new Date().toISOString() })
            .eq("id", customerId);

          return { success: true, preferences: prefs };
        } catch (err) {
          return { success: false, error: err.message };
        }
      },
    }),

    append_customer_memory: tool({
      description:
        "Append a free-form note to the customer's AI memory. Use this to remember context the AI should know " +
        "for future conversations — e.g. 'Customer was upset about delayed delivery on 2024-03-15, gave 10% discount', " +
        "'Customer is a repeat buyer of skincare products', 'Customer asked about wholesale pricing'. " +
        "Notes are timestamped automatically. Keep them short (1-2 sentences).",
      inputSchema: z.object({
        note: z.string().max(500).describe("The memory note to append (max 500 chars)"),
      }),
      execute: async ({ note }) => {
        if (!customerId) return { success: false, error: "No customer context" };
        try {
          const supabase = getSupabase();
          const { data: customer } = await supabase
            .from("customers")
            .select("ai_memory")
            .eq("id", customerId)
            .eq("account_id", accountId)
            .single();
          if (!customer) return { success: false, error: "Customer not found" };

          const ts = new Date().toISOString().slice(0, 10);
          const newMemory = (customer.ai_memory || "") + `\n[${ts}] ${note}`.trim();

          await supabase
            .from("customers")
            .update({ ai_memory: newMemory, updated_at: new Date().toISOString() })
            .eq("id", customerId);

          return { success: true, memory: newMemory };
        } catch (err) {
          return { success: false, error: err.message };
        }
      },
    }),
  };
};
