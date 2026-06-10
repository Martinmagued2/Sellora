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

export const createSalesTools = (accountId, customerId) => {
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
      description: "Validate a coupon code and get discount details. Use this when a customer mentions or asks about a coupon code, promo code, or discount code. Checks if the code is active, not expired, within usage limits, and meets minimum order value requirements.",
      inputSchema: z.object({
        code: z.string().describe("The coupon code to validate"),
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

    create_order: tool({
      description: "Create a new order in the system for the customer. ONLY call this AFTER the customer has explicitly confirmed they want to order and agreed to the total price.",
      inputSchema: z.object({
        items: z.array(z.object({
          productId: z.string().optional().describe("Product ID"),
          product_id: z.string().optional().describe("Alternative product ID"),
          quantity: z.coerce.number().positive().describe("Quantity of items"),
        })),
        shippingAddress: z.string().optional().describe("Customer's shipping address"),
        shipping_address: z.string().optional().describe("Alternative shipping address parameter"),
        paymentMethod: z.enum(["cod", "vodafone_cash", "instapay"]).optional().describe("Payment method"),
        payment_method: z.enum(["cod", "vodafone_cash", "instapay"]).optional().describe("Alternative payment method parameter"),
        coupon_code: z.string().optional().describe("Coupon code to apply to this order (optional)"),
      }),
      execute: async ({ items, shippingAddress, shipping_address, paymentMethod, payment_method, coupon_code }) => {
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

              // Increment used_count
              await getSupabase()
                .from("coupons")
                .update({ used_count: coupon.used_count + 1 })
                .eq("id", coupon.id);
            }
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
            source: "ai_agent"
          })
          .select("order_number")
          .single();

        if (error) {
          return { success: false, error: "Failed to create order" };
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
          message: "Order created successfully", 
          order_number: order.order_number,
          subtotal: subtotal,
          total,
          currency,
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
      description: "Validate a coupon code and get discount details. Use this when a customer mentions or asks about a coupon code, promo code, or discount code.",
      inputSchema: z.object({
        code: z.string().describe("The coupon code to validate"),
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
      description: "Get the current status of a specific order by its order number.",
      inputSchema: z.object({
        orderNumber: z.string().optional().describe("The order number to check"),
        order_number: z.string().optional().describe("Alternative order number parameter"),
      }),
      execute: async ({ orderNumber, order_number }) => {
        const finalOrderNumber = orderNumber || order_number;
        if (!finalOrderNumber) return { success: false, error: "Order number is required" };

        const { data, error } = await getSupabase()
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
