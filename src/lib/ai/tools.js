import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { dispatchWebhook } from "@/lib/webhooks";

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

// Helper to fetch account context
const getAccountCurrency = async (accountId) => {
  const { data } = await getSupabase()
    .from("accounts")
    .select("currency")
    .eq("id", accountId)
    .single();
  return data?.currency || "EGP";
};

// ─── AI Safety: fetch the high-value order threshold for this account ───
// Returns { highValueThreshold, currency, slaHours }.
// Defaults to 1000 / EGP / 4 hours if the column isn't set yet.
const getAccountSafetySettings = async (accountId) => {
  const { data } = await getSupabase()
    .from("accounts")
    .select("currency, ai_high_value_threshold, ai_sla_hours")
    .eq("id", accountId)
    .single();
  return {
    currency: data?.currency || "EGP",
    highValueThreshold: data?.ai_high_value_threshold != null
      ? Number(data.ai_high_value_threshold)
      : 1000,
    slaHours: data?.ai_sla_hours || 4,
  };
};

export const createSalesTools = (accountId, customerId, options = {}) => {
  // conversationId is needed so high-value orders can be saved as
  // pending_actions linked to the conversation that triggered them.
  const conversationId = options.conversationId || null;
  return {
    personalized_recommendations: tool({
      description: "Get personalized product recommendations for a customer based on their purchase history and similar customers' behavior. Use this when you want to suggest products a specific customer might like, such as 'you might also like', 'based on your style', or when you want to proactively upsell. Returns products with reasons like 'Frequently bought together', 'Similar category to your purchases', or 'Popular with similar customers'.",
      inputSchema: z.object({
        current_product_id: z.string().optional().describe("Optional: product the customer is currently viewing or discussing"),
        limit: z.coerce.number().optional().describe("Number of recommendations (default 3)"),
      }),
      execute: async ({ current_product_id, limit }) => {
        if (!customerId) {
          return { success: false, error: "No customer context available for recommendations" };
        }

        try {
          // Fetch customer's order history for collaborative filtering
          const supabase = getSupabase();
          const { data: customerOrders } = await supabase
            .from("orders")
            .select("items")
            .eq("customer_id", customerId)
            .eq("account_id", accountId)
            .order("created_at", { ascending: false })
            .limit(10);

          const purchasedProductIds = new Set();
          const purchasedCategories = new Set();

          if (customerOrders) {
            for (const order of customerOrders) {
              if (order.items && Array.isArray(order.items)) {
                for (const item of order.items) {
                  if (item.product_id) purchasedProductIds.add(item.product_id);
                }
              }
            }
          }

          // Get all active products (exclude hidden_from_ai and out-of-stock from AI recommendations)
          const { data: allProducts } = await supabase
            .from("products")
            .select("id, name, description, price, stock, category, variants")
            .eq("account_id", accountId)
            .eq("status", "active")
            .neq("hidden_from_ai", true)
            .gt("stock", 0);

          if (!allProducts || allProducts.length === 0) {
            return { success: true, recommendations: [], message: "No products available" };
          }

          // Collect purchased categories
          for (const pid of purchasedProductIds) {
            const prod = allProducts.find((p) => p.id === pid);
            if (prod?.category) purchasedCategories.add(prod.category);
          }

          // Collaborative filtering (simplified)
          let collabProductScores = {};
          if (purchasedProductIds.size > 0) {
            const pidArray = Array.from(purchasedProductIds);
            const { data: otherOrders } = await supabase
              .from("orders")
              .select("customer_id, items")
              .eq("account_id", accountId)
              .neq("customer_id", customerId)
              .limit(100);

            if (otherOrders) {
              const similarCustomers = new Set();
              for (const order of otherOrders) {
                if (order.items && Array.isArray(order.items)) {
                  for (const item of order.items) {
                    if (pidArray.includes(item.product_id)) {
                      similarCustomers.add(order.customer_id);
                      break;
                    }
                  }
                }
              }

              if (similarCustomers.size > 0) {
                const { data: similarOrders } = await supabase
                  .from("orders")
                  .select("items")
                  .eq("account_id", accountId)
                  .in("customer_id", Array.from(similarCustomers))
                  .limit(200);

                if (similarOrders) {
                  for (const order of similarOrders) {
                    if (order.items && Array.isArray(order.items)) {
                      for (const item of order.items) {
                        if (item.product_id && !purchasedProductIds.has(item.product_id)) {
                          collabProductScores[item.product_id] = (collabProductScores[item.product_id] || 0) + 1;
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          const recLimit = limit || 3;
          const currentProduct = current_product_id ? allProducts.find(p => p.id === current_product_id) : null;

          const scored = allProducts
            .filter((p) => p.id !== current_product_id)
            .map((product) => {
              let score = 0;
              let reason = "Popular product";

              if (collabProductScores[product.id]) {
                score += collabProductScores[product.id] * 10;
                reason = "Popular with similar customers";
              }

              if (purchasedCategories.has(product.category) && !purchasedProductIds.has(product.id)) {
                score += 5;
                reason = "Similar category to your purchases";
              }

              if (product.stock > 0) score += 2;

              if (purchasedProductIds.size === 0) {
                score += Math.random() * 3;
                reason = "Trending product";
              }

              if (currentProduct && product.category === currentProduct.category) {
                score += 3;
                reason = "Frequently bought together";
              }

              return { ...product, score, reason };
            });

          const currency = await getAccountCurrency(accountId);
          const recommendations = scored
            .sort((a, b) => b.score - a.score)
            .slice(0, recLimit)
            .map(({ score, ...rest }) => rest);

          return {
            success: true,
            currency,
            recommendations,
            message: recommendations.length > 0
              ? `Found ${recommendations.length} personalized recommendations based on purchase history`
              : "No personalized recommendations available",
          };
        } catch (err) {
          console.error("Personalized recommendations error:", err);
          return { success: false, error: "Failed to get recommendations" };
        }
      },
    }),

    recommend_products: tool({
      description: "Recommend products based on a customer's needs, preferences, or context. Use this when a customer asks for suggestions like 'something for dry skin', 'a gift for my mom', or 'I need something casual'. Searches product names, descriptions, and categories to find the best matches.",
      inputSchema: z.object({
        query: z.string().describe("The customer's need, preference, or context (e.g. 'dry skin', 'gift for mom', 'casual outfit')"),
      }),
      execute: async ({ query }) => {
        if (!query) {
          return { success: false, error: "Please describe what you're looking for" };
        }

        const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

        // Fetch all active products for this account (exclude hidden_from_ai and out-of-stock)
        const { data: products, error } = await getSupabase()
          .from("products")
          .select("id, name, description, price, stock, category, variants")
          .eq("account_id", accountId)
          .eq("status", "active")
          .neq("hidden_from_ai", true)
          .gt("stock", 0);

        if (error) {
          return { success: false, error: "Failed to search products" };
        }

        if (!products || products.length === 0) {
          return { success: true, message: "No products available at the moment.", products: [] };
        }

        // Score each product based on relevance to the query
        const scored = products.map((product) => {
          let score = 0;
          const nameLower = (product.name || "").toLowerCase();
          const descLower = (product.description || "").toLowerCase();
          const catLower = (product.category || "").toLowerCase();
          // Also search in variant names (e.g. "red", "large", "32GB")
          const variantText = (product.variants || []).map(v => v.name).join(" ").toLowerCase();
          const allText = `${nameLower} ${descLower} ${catLower} ${variantText}`;

          for (const term of searchTerms) {
            if (nameLower.includes(term)) score += 10; // Name match is strongest
            if (catLower.includes(term)) score += 8;   // Category match
            if (descLower.includes(term)) score += 5;   // Description match
            if (variantText.includes(term)) score += 7;  // Variant match (e.g. "red", "large")
            if (allText.includes(term)) score += 2;     // Any mention
          }

          // Boost products that are in stock
          if (product.stock > 0) score += 3;

          return { ...product, score };
        });

        // Filter to products with some relevance and sort by score
        const recommendations = scored
          .filter((p) => p.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        if (recommendations.length === 0) {
          return { success: true, message: `I couldn't find products matching "${query}". Let me show you what we have available.`, products: products.slice(0, 5) };
        }

        const currency = await getAccountCurrency(accountId);
        return { success: true, currency, query, products: recommendations.map(({ score, ...rest }) => rest) };
      },
    }),

    search_products: tool({
      description: "Search the store's inventory for products by name or category. Use this when the customer asks what you sell or is looking for something specific.",
      inputSchema: z.object({
        query: z.string().optional().describe("Search term, product name, or category to look for (optional)"),
        search_query: z.string().optional().describe("Alternative search query parameter"),
      }),
      execute: async ({ query, search_query }) => {
        const finalQuery = query || search_query;
        let dbQuery = getSupabase()
          .from("products")
          .select("id, name, description, price, stock, category, variants")
          .eq("account_id", accountId)
          .eq("status", "active")
          .neq("hidden_from_ai", true)
          .gt("stock", 0)
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
      inputSchema: z.object({
        productId: z.string().optional().describe("The ID of the product to check"),
        product_id: z.string().optional().describe("Alternative product ID parameter"),
        name: z.string().optional().describe("The name of the product to check (alternative if ID is unknown)"),
        product_name: z.string().optional().describe("Alternative product name parameter"),
      }),
      execute: async ({ productId, product_id, name, product_name }) => {
        const finalId = productId || product_id;
        const finalName = name || product_name;

        let dbQuery = getSupabase()
          .from("products")
          .select("id, name, stock, variants")
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
        const result = { success: true, product: product.name, in_stock: product.stock > 0, stock_quantity: product.stock, productId: product.id };
        // Include variant-level stock if available
        if (product.variants && product.variants.length > 0) {
          result.variants = product.variants.map(v => ({
            name: v.name,
            price: v.price,
            in_stock: v.stock > 0,
            stock_quantity: v.stock,
          }));
        }
        return result;
      },
    }),

    calculate_cart_total: tool({
      description: "Calculate the total cost for a list of items before creating an order. Use this to confirm the total with the customer.",
      inputSchema: z.object({
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

          const { data } = await getSupabase()
            .from("products")
            .select("id, name, price, variants")
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
              subtotal: lineTotal,
              variants: data.variants || null,
            });
          }
        }

        const currency = await getAccountCurrency(accountId);
        return { success: true, total, currency, items: lineItems };
      },
    }),

    search_faq: tool({
      description: "Search the shop's FAQ knowledge base for answers to common questions about shipping, returns, locations, hours, and policies. Use this BEFORE generating a reply when a customer asks a general question that might be covered in the FAQ.",
      inputSchema: z.object({
        query: z.string().describe("The customer's question or topic to search for in the FAQ (e.g. 'shipping', 'return policy', 'store hours')"),
      }),
      execute: async ({ query }) => {
        if (!query) return { success: false, error: "Query is required" };

        const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

        const { data: faqs, error } = await getSupabase()
          .from("faqs")
          .select("id, question, answer, category")
          .eq("account_id", accountId)
          .eq("is_active", true);

        if (error) {
          return { success: false, error: "Failed to search FAQs" };
        }

        if (!faqs || faqs.length === 0) {
          return { success: true, found: false, message: "No FAQ entries found for this store." };
        }

        const scored = faqs.map((faq) => {
          let score = 0;
          const qLower = (faq.question || "").toLowerCase();
          const aLower = (faq.answer || "").toLowerCase();
          const cLower = (faq.category || "").toLowerCase();
          const allText = `${qLower} ${aLower} ${cLower}`;

          for (const term of searchTerms) {
            if (qLower.includes(term)) score += 10;
            if (cLower.includes(term)) score += 8;
            if (aLower.includes(term)) score += 5;
            if (allText.includes(term)) score += 2;
          }

          return { ...faq, score };
        });

        const matches = scored
          .filter((f) => f.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        if (matches.length === 0) {
          return { success: true, found: false, message: "No matching FAQ found. Answer from your general knowledge." };
        }

        return {
          success: true,
          found: true,
          faqs: matches.map(({ score, ...rest }) => rest),
        };
      },
    }),

    validate_coupon: tool({
      description: "Validate a coupon code and get discount details. Use this when a customer mentions or asks about a coupon code, promo code, or discount code. IMPORTANT: You MUST extract the exact coupon code from the customer's message (e.g. if they say 'MAR10' or 'I have code SUMMER50', pass 'MAR10' or 'SUMMER50' as the code parameter). NEVER pass an empty string. Checks if the code is active, not expired, within usage limits, and meets minimum order value requirements.",
      inputSchema: z.object({
        code: z.string().describe("The exact coupon code the customer provided (e.g. 'MAR10', 'SUMMER50'). Must NOT be empty."),
        order_total: z.coerce.number().optional().describe("The current order total to check against minimum order value requirements"),
      }),
      execute: async ({ code, order_total }) => {
        if (!code || !code.trim()) {
          return { success: false, error: "Coupon code is required" };
        }

        const now = new Date();

        // Look up coupon by code and account
        const { data: coupon, error } = await getSupabase()
          .from("coupons")
          .select("*")
          .eq("account_id", accountId)
          .eq("code", code.trim().toUpperCase())
          .single();

        if (error || !coupon) {
          return { success: false, valid: false, error: "Invalid coupon code. This code does not exist or is not for this store." };
        }

        // Validation checks
        if (!coupon.is_active) {
          return { success: true, valid: false, error: "This coupon is no longer active", coupon: { code: coupon.code, type: coupon.type } };
        }

        if (coupon.starts_at && new Date(coupon.starts_at) > now) {
          return { success: true, valid: false, error: "This coupon is not yet active", coupon: { code: coupon.code, type: coupon.type, starts_at: coupon.starts_at } };
        }

        if (coupon.expires_at && new Date(coupon.expires_at) < now) {
          return { success: true, valid: false, error: "This coupon has expired", coupon: { code: coupon.code, type: coupon.type, expires_at: coupon.expires_at } };
        }

        if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
          return { success: true, valid: false, error: "This coupon has reached its usage limit", coupon: { code: coupon.code, type: coupon.type, max_uses: coupon.max_uses, used_count: coupon.used_count } };
        }

        if (order_total !== undefined && coupon.min_order_value > 0 && order_total < parseFloat(coupon.min_order_value)) {
          const currency = await getAccountCurrency(accountId);
          return { success: true, valid: false, error: `Minimum order value is ${coupon.min_order_value} ${currency}. Your order total is ${order_total} ${currency}.`, coupon: { code: coupon.code, type: coupon.type, min_order_value: coupon.min_order_value } };
        }

        // Coupon is valid — calculate discount
        let discountAmount = 0;
        const total = order_total || 0;
        const currency = await getAccountCurrency(accountId);

        if (coupon.type === "percentage") {
          discountAmount = total * (coupon.value / 100);
          discountAmount = Math.min(discountAmount, total);
        } else if (coupon.type === "fixed") {
          discountAmount = parseFloat(coupon.value);
          if (total > 0) discountAmount = Math.min(discountAmount, total);
        } else if (coupon.type === "free_shipping") {
          discountAmount = 0; // Shipping discount handled separately
        }

        return {
          success: true,
          valid: true,
          discount_amount: discountAmount,
          currency,
          coupon: {
            id: coupon.id,
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            min_order_value: coupon.min_order_value,
            applies_to: coupon.applies_to,
            product_ids: coupon.product_ids,
            categories: coupon.categories,
          },
          message: coupon.type === "percentage"
            ? `${coupon.value}% discount applied! You save ${discountAmount.toFixed(2)} ${currency}.`
            : coupon.type === "fixed"
            ? `${coupon.value} ${currency} discount applied!`
            : "Free shipping applied!",
        };
      },
    }),

    list_active_coupons: tool({
      description: "List all currently active and valid coupon codes for the store. Use this when a customer asks 'do you have any discounts?', 'are there any coupons?', or 'is there a sale?'. Returns available coupon codes with their discount type and value.",
      inputSchema: z.object({}),
      execute: async () => {
        const now = new Date().toISOString();

        const { data: coupons, error } = await getSupabase()
          .from("coupons")
          .select("id, code, type, value, min_order_value, applies_to, categories, starts_at, expires_at, max_uses, used_count")
          .eq("account_id", accountId)
          .eq("is_active", true)
          .lte("starts_at", now)
          .or(`expires_at.is.null,expires_at.gte.${now}`);

        if (error) {
          return { success: false, error: "Failed to fetch coupons" };
        }

        if (!coupons || coupons.length === 0) {
          return { success: true, coupons: [], message: "No active coupons available at the moment." };
        }

        // Filter out exhausted coupons
        const available = coupons.filter(c => c.max_uses === null || c.used_count < c.max_uses);

        if (available.length === 0) {
          return { success: true, coupons: [], message: "No coupons currently available — all have been used up." };
        }

        const currency = await getAccountCurrency(accountId);

        const formatted = available.map(c => {
          let desc = "";
          if (c.type === "percentage") desc = `${c.value}% off`;
          else if (c.type === "fixed") desc = `${c.value} ${currency} off`;
          else if (c.type === "free_shipping") desc = "Free shipping";

          let conditions = [];
          if (c.min_order_value > 0) conditions.push(`min order ${c.min_order_value} ${currency}`);
          if (c.applies_to === "specific_products") conditions.push("select products only");
          if (c.applies_to === "specific_categories") conditions.push("select categories only");
          if (c.max_uses !== null) conditions.push(`limited uses: ${c.max_uses - c.used_count} left`);

          return {
            code: c.code,
            discount: desc,
            type: c.type,
            value: c.value,
            conditions: conditions.length > 0 ? conditions.join(", ") : "no restrictions",
          };
        });

        return {
          success: true,
          coupons: formatted,
          currency,
          message: `Found ${formatted.length} active coupon${formatted.length > 1 ? 's' : ''} available!`,
        };
      },
    }),

    create_order: tool({
      description: "Create a new order in the system for the customer. ONLY call this AFTER the customer has explicitly confirmed they want to order and agreed to the total price. Include the customer's name, phone, and email if collected.",
      inputSchema: z.object({
        items: z.array(z.object({
          productId: z.string().optional().describe("Product ID"),
          product_id: z.string().optional().describe("Alternative product ID"),
          quantity: z.coerce.number().positive().describe("Quantity of items"),
        })),
        shippingAddress: z.string().optional().describe("Customer's shipping address (include street, building, apartment, city)"),
        shipping_address: z.string().optional().describe("Alternative shipping address parameter"),
        paymentMethod: z.enum(["cod", "vodafone_cash", "instapay"]).optional().describe("Payment method"),
        payment_method: z.enum(["cod", "vodafone_cash", "instapay"]).optional().describe("Alternative payment method parameter"),
        coupon_code: z.string().optional().describe("Coupon code to apply to this order (optional)"),
        customer_name: z.string().optional().describe("Customer's full name (if collected during ordering)"),
        customer_phone: z.string().optional().describe("Customer's phone number (if collected during ordering)"),
        customer_email: z.string().optional().describe("Customer's email address (if collected during ordering)"),
      }),
      execute: async ({ items, shippingAddress, shipping_address, paymentMethod, payment_method, coupon_code, customer_name, customer_phone, customer_email }) => {
        const finalShippingAddress = shippingAddress || shipping_address || "Address needed";
        const finalPaymentMethod = paymentMethod || payment_method || "cod";

        // 1. Calculate total and format items for DB
        let total = 0;
        let dbItems = [];
        
        for (const item of items) {
          const finalId = item.productId || item.product_id;
          if (!finalId) continue;

          const { data } = await getSupabase()
            .from("products")
            .select("id, name, price, stock, variants, category")
            .eq("id", finalId)
            .eq("account_id", accountId)
            .single();

          if (data && data.stock >= item.quantity) {
            total += data.price * item.quantity;
            dbItems.push({
              product_id: data.id,
              name: data.name,
              price: data.price,
              qty: item.quantity,
              category: data.category,
            });
          } else if (data) {
             return { success: false, error: `Insufficient stock for ${data.name}. Only ${data.stock} available.` };
          }
        }

        if (dbItems.length === 0) {
           return { success: false, error: "No valid items to order." };
        }

        // 2. Apply coupon if provided
        let discountAmount = 0;
        let couponId = null;
        const subtotal = total;
        const currency = await getAccountCurrency(accountId);

        if (coupon_code) {
          const { data: coupon, error: couponError } = await getSupabase()
            .from("coupons")
            .select("*")
            .eq("account_id", accountId)
            .eq("code", coupon_code.trim().toUpperCase())
            .single();

          if (!couponError && coupon) {
            // Validate
            const now = new Date();
            if (coupon.is_active &&
                (!coupon.starts_at || new Date(coupon.starts_at) <= now) &&
                (!coupon.expires_at || new Date(coupon.expires_at) >= now) &&
                (coupon.max_uses === null || coupon.used_count < coupon.max_uses) &&
                (!coupon.min_order_value || total >= parseFloat(coupon.min_order_value))) {
              
              // Calculate discount
              if (coupon.type === "percentage") {
                discountAmount = total * (coupon.value / 100);
                discountAmount = Math.min(discountAmount, total);
              } else if (coupon.type === "fixed") {
                discountAmount = Math.min(parseFloat(coupon.value), total);
              }

              total = Math.max(0, total - discountAmount);
              couponId = coupon.id;

              // SECURITY FIX: Atomic coupon increment to prevent double-spend
              // Use conditional update: only increment if used_count < max_uses
              if (coupon.max_uses === null) {
                // No limit — safe to increment directly
                await getSupabase()
                  .from("coupons")
                  .update({ used_count: coupon.used_count + 1 })
                  .eq("id", coupon.id);
              } else {
                // Has limit — use conditional update to prevent race condition
                const { data: updateResult } = await getSupabase()
                  .from("coupons")
                  .update({ used_count: coupon.used_count + 1 })
                  .eq("id", coupon.id)
                  .eq("used_count", coupon.used_count) // Only succeed if count hasn't changed
                  .select("id");
                
                if (!updateResult || updateResult.length === 0) {
                  // Race condition detected — another request already used this coupon
                  discountAmount = 0;
                  total = subtotal;
                  couponId = null;
                }
              }
            }
          }
        }

        // 2b. Update customer info if provided
        if (customer_name || customer_phone || customer_email) {
          const customerUpdates = {};
          if (customer_name) customerUpdates.name = customer_name;
          if (customer_phone) customerUpdates.phone = customer_phone;
          if (customer_email) customerUpdates.email = customer_email;
          await getSupabase().from("customers").update(customerUpdates).eq("id", customerId);
        }

        // ─── AI Safety: High-value order approval ───
        // If the order total exceeds the account's ai_high_value_threshold,
        // we do NOT create the order automatically. Instead we save it as a
        // pending_action so the owner can approve or reject it from the
        // dashboard. The owner's approve endpoint will execute the order.
        //
        // This prevents the AI from creating very large orders that may have
        // been triggered by a misunderstanding (e.g. customer said "100" but
        // meant quantity 1 with price 100, not 100 units).
        let safetySettings;
        try {
          safetySettings = await getAccountSafetySettings(accountId);
        } catch (e) {
          safetySettings = { currency, highValueThreshold: 1000, slaHours: 4 };
        }

        if (total > safetySettings.highValueThreshold) {
          console.log(
            `[create_order] AI Safety: order total ${total} ${safetySettings.currency} exceeds high-value threshold ${safetySettings.highValueThreshold} ${safetySettings.currency} — saving as pending action for owner approval`
          );

          try {
            const { data: pendingAction, error: pendingErr } = await getSupabase()
              .from("pending_actions")
              .insert({
                account_id: accountId,
                conversation_id: conversationId,
                customer_id: customerId,
                action_type: "create_order",
                payload: {
                  items: dbItems,
                  subtotal,
                  total,
                  currency: safetySettings.currency,
                  discount_amount: discountAmount,
                  coupon_id: couponId,
                  coupon_code: coupon_code ? coupon_code.trim().toUpperCase() : null,
                  payment_method: finalPaymentMethod,
                  shipping_address: finalShippingAddress,
                  customer_name: customer_name || null,
                  customer_phone: customer_phone || null,
                  customer_email: customer_email || null,
                  channel: "ai_agent",
                  source: "ai_agent",
                  reason: "high_value_order_approval",
                  high_value_threshold: safetySettings.highValueThreshold,
                },
                status: "pending",
                proposed_by: "ai",
              })
              .select("id")
              .single();

            if (pendingErr) {
              console.error("[create_order] Failed to save high-value pending action:", pendingErr.message);
              // Fall through to normal order creation as a safety net —
              // better to create the order than to lose it entirely.
            } else {
              return {
                success: true,
                pending_approval: true,
                pending_action_id: pendingAction?.id,
                message: `This order (${total.toFixed(2)} ${safetySettings.currency}) exceeds the high-value threshold of ${safetySettings.highValueThreshold} ${safetySettings.currency} and has been saved for the store owner to approve. Tell the customer: "I've prepared your order for ${total.toFixed(2)} ${safetySettings.currency} and our team will confirm it shortly." Do NOT tell the customer the order is confirmed yet — it must be approved first.`,
                subtotal,
                total,
                currency: safetySettings.currency,
                items: dbItems,
                high_value_threshold: safetySettings.highValueThreshold,
              };
            }
          } catch (pendingErr) {
            console.error("[create_order] High-value pending action exception:", pendingErr.message);
            // Fall through to normal order creation
          }
        }

        // 3. Insert Order
        const { data: order, error } = await getSupabase()
          .from("orders")
          .insert({
            account_id: accountId,
            customer_id: customerId,
            items: dbItems,
            subtotal: subtotal,
            total: total,
            coupon_id: couponId,
            coupon_code: coupon_code ? coupon_code.trim().toUpperCase() : null,
            discount_amount: discountAmount,
            status: "pending",
            payment_method: finalPaymentMethod,
            shipping_address: finalShippingAddress,
            customer_name: customer_name || null,
            customer_phone: customer_phone || null,
            customer_email: customer_email || null,
            source: "ai_agent"
          })
          .select("id, order_number")
          .maybeSingle();

        if (error || !order) {
          return { success: false, error: "Failed to create order: " + (error?.message || "unknown") };
        }

        // 4. Decrement stock for each item
        for (const item of dbItems) {
          await getSupabase().rpc('decrement_stock', {
            p_id: item.product_id,
            qty: item.qty
          }).catch(async () => {
            const { data: prod } = await getSupabase()
              .from("products")
              .select("stock")
              .eq("id", item.product_id)
              .single();
            if (prod) {
              await getSupabase()
                .from("products")
                .update({ stock: Math.max(0, prod.stock - item.qty) })
                .eq("id", item.product_id);
            }
          });
        }

        const result = {
          success: true,
          message: `✅ Order created! Order number: ${order.order_number}`,
          order_number: order.order_number,
          order_id: order.id,
          subtotal: subtotal,
          total,
          currency,
          items: dbItems,
          payment_method: finalPaymentMethod,
          shipping_address: finalShippingAddress,
        };

        if (discountAmount > 0) {
          result.discount_amount = discountAmount;
          result.coupon_code = coupon_code.trim().toUpperCase();
          result.message += ` Coupon ${coupon_code.trim().toUpperCase()} applied! ${discountAmount.toFixed(2)} ${currency} discount.`;
        }

        // Dispatch webhook for order.created
        dispatchWebhook(accountId, "order.created", {
          orderId: order.id,
          orderNumber: order.order_number,
          items: dbItems,
          subtotal,
          total,
          currency,
          couponCode: coupon_code || null,
          discountAmount,
          customerId,
          status: "pending",
          source: "ai_agent",
        }).catch(err => console.error("[ORDER] Webhook dispatch failed:", err.message));

        return result;
      },
    }),

    redeem_coupon: tool({
      description: "Redeem (apply) a coupon code for a customer. This decrements the coupon's usage count and returns the discount amount. Use this AFTER validating the coupon with validate_coupon, when the customer confirms they want to apply the discount. This is the action that actually uses up the coupon.",
      inputSchema: z.object({
        code: z.string().describe("The coupon code to redeem"),
        order_total: z.coerce.number().describe("The current order total (before discount)"),
        order_id: z.string().optional().describe("The order ID to link the coupon to (if an order exists)"),
      }),
      execute: async ({ code, order_total, order_id }) => {
        if (!code || !code.trim()) {
          return { success: false, error: "Coupon code is required" };
        }

        try {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
          const res = await fetch(`${baseUrl}/api/coupons/redeem`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: code.trim(),
              order_total,
              account_id: accountId,
              order_id: order_id || null,
            }),
          });

          const data = await res.json();

          if (data.redeemed) {
            const currency = await getAccountCurrency(accountId);
            return {
              success: true,
              redeemed: true,
              discount_amount: data.discount_amount,
              currency,
              coupon: data.coupon,
              message: data.coupon.type === "percentage"
                ? `Coupon ${data.coupon.code} redeemed! ${data.coupon.value}% off = ${data.discount_amount.toFixed(2)} ${currency} discount. New total: ${(order_total - data.discount_amount).toFixed(2)} ${currency}`
                : data.coupon.type === "fixed"
                ? `Coupon ${data.coupon.code} redeemed! ${data.coupon.value} ${currency} off. New total: ${(order_total - data.discount_amount).toFixed(2)} ${currency}`
                : `Coupon ${data.coupon.code} redeemed! Free shipping applied.`,
            };
          } else {
            return { success: false, redeemed: false, error: data.error || "Failed to redeem coupon" };
          }
        } catch (err) {
          return { success: false, error: "Failed to redeem coupon: " + err.message };
        }
      },
    }),
  };
};

export const createSupportTools = (accountId, customerId) => {
  return {
    search_knowledge_base: tool({
      description:
        "Search the store's knowledge base for policies, shipping info, return policies, size guides, care instructions, or any uploaded documents. " +
        "Use this BEFORE answering general questions like 'what's your return policy?', 'how do I care for this?', 'do you ship internationally?' " +
        "Returns relevant text chunks from the merchant's uploaded documents. If no match, fall back to the FAQ tool.",
      inputSchema: z.object({
        query: z.string().describe("The question or topic to search for (e.g. 'return policy', 'shipping times', 'size chart')"),
      }),
      execute: async ({ query }) => {
        try {
          const supabase = getSupabase();
          const { data: docs } = await supabase
            .from("knowledge_documents")
            .select("id, title, chunks")
            .eq("account_id", accountId)
            .eq("is_active", true);

          if (!docs || docs.length === 0) {
            return { success: false, message: "No knowledge base documents available." };
          }

          // Simple keyword search across all chunks
          const queryLower = query.toLowerCase();
          const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

          const scored = [];
          for (const doc of docs) {
            const chunks = Array.isArray(doc.chunks) ? doc.chunks : [];
            for (const chunk of chunks) {
              const chunkLower = (chunk || "").toLowerCase();
              let score = 0;
              for (const term of queryTerms) {
                const matches = (chunkLower.match(new RegExp(term, "g")) || []).length;
                score += matches;
              }
              if (score > 0) {
                scored.push({ doc_title: doc.title, chunk, score });
              }
            }
          }

          scored.sort((a, b) => b.score - a.score);
          const top = scored.slice(0, 3);

          if (top.length === 0) {
            return { success: true, message: "No matching documents found.", results: [] };
          }

          return {
            success: true,
            results: top.map((r) => ({ source: r.doc_title, content: r.chunk })),
          };
        } catch (err) {
          return { success: false, error: err.message };
        }
      },
    }),

    recommend_products: tool({
      description: "Recommend products based on a customer's needs, preferences, or context. Use this when a customer asks for suggestions like 'something for dry skin', 'a gift for my mom', or 'I need something casual'. Searches product names, descriptions, and categories to find the best matches.",
      inputSchema: z.object({
        query: z.string().describe("The customer's need, preference, or context (e.g. 'dry skin', 'gift for mom', 'casual outfit')"),
      }),
      execute: async ({ query }) => {
        if (!query) {
          return { success: false, error: "Please describe what you're looking for" };
        }

        const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

        // Fetch active products (exclude hidden_from_ai and out-of-stock)
        const { data: products, error } = await getSupabase()
          .from("products")
          .select("id, name, description, price, stock, category, variants")
          .eq("account_id", accountId)
          .eq("status", "active")
          .neq("hidden_from_ai", true)
          .gt("stock", 0);

        if (error) {
          return { success: false, error: "Failed to search products" };
        }

        if (!products || products.length === 0) {
          return { success: true, message: "No products available at the moment.", products: [] };
        }

        const scored = products.map((product) => {
          let score = 0;
          const nameLower = (product.name || "").toLowerCase();
          const descLower = (product.description || "").toLowerCase();
          const catLower = (product.category || "").toLowerCase();
          const variantText = (product.variants || []).map(v => v.name).join(" ").toLowerCase();
          const allText = `${nameLower} ${descLower} ${catLower} ${variantText}`;

          for (const term of searchTerms) {
            if (nameLower.includes(term)) score += 10;
            if (catLower.includes(term)) score += 8;
            if (descLower.includes(term)) score += 5;
            if (variantText.includes(term)) score += 7;
            if (allText.includes(term)) score += 2;
          }

          if (product.stock > 0) score += 3;

          return { ...product, score };
        });

        const recommendations = scored
          .filter((p) => p.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        if (recommendations.length === 0) {
          return { success: true, message: `I couldn't find products matching "${query}".`, products: products.slice(0, 5) };
        }

        const currency = await getAccountCurrency(accountId);
        return { success: true, currency, query, products: recommendations.map(({ score, ...rest }) => rest) };
      },
    }),

    search_faq: tool({
      description: "Search the shop's FAQ knowledge base for answers to common questions about shipping, returns, locations, hours, and policies. Use this BEFORE generating a reply when a customer asks a general question that might be covered in the FAQ.",
      inputSchema: z.object({
        query: z.string().describe("The customer's question or topic to search for in the FAQ (e.g. 'shipping', 'return policy', 'store hours')"),
      }),
      execute: async ({ query }) => {
        if (!query) return { success: false, error: "Query is required" };

        const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

        const { data: faqs, error } = await getSupabase()
          .from("faqs")
          .select("id, question, answer, category")
          .eq("account_id", accountId)
          .eq("is_active", true);

        if (error) {
          return { success: false, error: "Failed to search FAQs" };
        }

        if (!faqs || faqs.length === 0) {
          return { success: true, found: false, message: "No FAQ entries found for this store." };
        }

        // Score FAQs by relevance
        const scored = faqs.map((faq) => {
          let score = 0;
          const qLower = (faq.question || "").toLowerCase();
          const aLower = (faq.answer || "").toLowerCase();
          const cLower = (faq.category || "").toLowerCase();
          const allText = `${qLower} ${aLower} ${cLower}`;

          for (const term of searchTerms) {
            if (qLower.includes(term)) score += 10;
            if (cLower.includes(term)) score += 8;
            if (aLower.includes(term)) score += 5;
            if (allText.includes(term)) score += 2;
          }

          return { ...faq, score };
        });

        const matches = scored
          .filter((f) => f.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        if (matches.length === 0) {
          return { success: true, found: false, message: "No matching FAQ found. Answer from your general knowledge." };
        }

        return {
          success: true,
          found: true,
          faqs: matches.map(({ score, ...rest }) => rest),
        };
      },
    }),

    validate_coupon: tool({
      description: "Validate a coupon code and get discount details. Use this when a customer mentions or asks about a coupon code, promo code, or discount code. IMPORTANT: You MUST extract the exact coupon code from the customer's message (e.g. if they say 'MAR10' or 'I have code SUMMER50', pass 'MAR10' or 'SUMMER50' as the code parameter). NEVER pass an empty string.",
      inputSchema: z.object({
        code: z.string().describe("The exact coupon code the customer provided (e.g. 'MAR10', 'SUMMER50'). Must NOT be empty."),
        order_total: z.coerce.number().optional().describe("The current order total"),
      }),
      execute: async ({ code, order_total }) => {
        if (!code || !code.trim()) {
          return { success: false, error: "Coupon code is required" };
        }

        const now = new Date();
        const { data: coupon, error } = await getSupabase()
          .from("coupons")
          .select("*")
          .eq("account_id", accountId)
          .eq("code", code.trim().toUpperCase())
          .single();

        if (error || !coupon) {
          return { success: false, valid: false, error: "Invalid coupon code" };
        }

        if (!coupon.is_active) {
          return { success: true, valid: false, error: "This coupon is no longer active" };
        }

        if (coupon.expires_at && new Date(coupon.expires_at) < now) {
          return { success: true, valid: false, error: "This coupon has expired" };
        }

        if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
          return { success: true, valid: false, error: "This coupon has reached its usage limit" };
        }

        let discountAmount = 0;
        const total = order_total || 0;
        const currency = await getAccountCurrency(accountId);

        if (coupon.type === "percentage") {
          discountAmount = total * (coupon.value / 100);
        } else if (coupon.type === "fixed") {
          discountAmount = parseFloat(coupon.value);
        }

        return {
          success: true,
          valid: true,
          discount_amount: discountAmount,
          currency,
          coupon: { code: coupon.code, type: coupon.type, value: coupon.value },
        };
      },
    }),

    get_customer_orders: tool({
      description: "Get all recent orders for the current customer.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await getSupabase()
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
      description: "Get the current status of a specific order by its order number. Accepts formats like 'ORD-001016' or 'ord-001016' (case-insensitive).",
      inputSchema: z.object({
        orderNumber: z.string().optional().describe("The order number to check (e.g. 'ORD-001016')"),
        order_number: z.string().optional().describe("Alternative order number parameter"),
      }),
      execute: async ({ orderNumber, order_number }) => {
        const finalOrderNumber = (orderNumber || order_number || "").toUpperCase().trim();
        if (!finalOrderNumber) return { success: false, error: "Order number is required" };

        const { data, error } = await getSupabase()
          .from("orders")
          .select("order_number, status, total, currency, created_at, tracking_number, carrier, payment_status, items")
          .eq("account_id", accountId)
          .eq("order_number", finalOrderNumber)
          .single();

        if (error || !data) {
          // Fallback: case-insensitive search
          const { data: fallback } = await getSupabase()
            .from("orders")
            .select("order_number, status, total, currency, created_at, tracking_number, carrier, payment_status, items")
            .eq("account_id", accountId)
            .ilike("order_number", finalOrderNumber)
            .single();
          if (fallback) return { success: true, order: fallback };
          return { success: false, error: `Order '${finalOrderNumber}' not found` };
        }
        return { success: true, order: data };
      },
    }),
  };
};
