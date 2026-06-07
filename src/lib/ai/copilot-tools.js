import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { generateProductImage } from "@/lib/ai/image-generator";

export const createCopilotTools = (accountId) => {
  // Create Supabase client lazily inside the function to avoid build-time errors
  // (env vars are not available during `next build`)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return {
    // ─── ANALYTICS TOOLS ───

    get_store_analytics: tool({
      description: "Get basic store analytics for a given time period (e.g. recent orders, revenue). Use this when the seller asks 'how are my sales?' or wants a quick overview.",
      inputSchema: z.object({
        days: z.string().optional().describe("Number of past days to analyze (default 30)"),
      }),
      execute: async ({ days }) => {
        const daysNum = parseInt(days) || 30;
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - daysNum);

        const { data, error } = await supabase
          .from("orders")
          .select("id, total, status, created_at")
          .eq("account_id", accountId)
          .gte("created_at", dateLimit.toISOString());

        if (error || !data) return { success: false, error: "Failed to fetch analytics" };

        const totalRevenue = data.reduce((sum, order) => sum + (order.total || 0), 0);
        const orderCount = data.length;
        const pendingCount = data.filter((o) => o.status === "pending").length;
        const deliveredCount = data.filter((o) => o.status === "delivered").length;
        const cancelledCount = data.filter((o) => o.status === "cancelled").length;
        const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

        return {
          success: true,
          days: daysNum,
          totalRevenue,
          orderCount,
          pendingCount,
          deliveredCount,
          cancelledCount,
          avgOrderValue,
          _action: { type: "navigate", path: "/dashboard/analytics", label: "View Analytics" },
        };
      },
    }),

    get_sales_report: tool({
      description: "Generate a detailed sales/income report for the store. Includes revenue breakdown, order stats, top-selling products, and trends. Use when the seller asks for a report, income summary, or detailed sales analysis. The period must be one of: today, week, month, quarter, year.",
      inputSchema: z.object({
        period: z.string().describe("The time period for the report. Must be one of: today, week, month, quarter, year"),
      }),
      execute: async ({ period }) => {
        // Normalize period string to valid value
        const periodMap = { today: 'today', week: 'week', month: 'month', quarterly: 'quarter', quarter: 'quarter', year: 'year', yearly: 'year', annual: 'year', daily: 'today', weekly: 'week', monthly: 'month' };
        const normalizedPeriod = periodMap[period?.toLowerCase()?.trim()] || 'month';
        const now = new Date();
        let startDate;

        switch (normalizedPeriod) {
          case "today":
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case "week":
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            break;
          case "month":
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 30);
            break;
          case "quarter":
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 90);
            break;
          case "year":
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 365);
            break;
        }

        // Fetch orders for the period
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select("id, total, status, created_at, items, payment_method")
          .eq("account_id", accountId)
          .gte("created_at", startDate.toISOString());

        if (ordersError) return { success: false, error: "Failed to fetch orders for report" };

        // Fetch products for inventory analysis
        const { data: products } = await supabase
          .from("products")
          .select("id, name, price, stock, category, status")
          .eq("account_id", accountId);

        // Calculate metrics
        const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
        const completedRevenue = orders.filter(o => o.status === "delivered" || o.status === "confirmed").reduce((sum, o) => sum + (o.total || 0), 0);
        const pendingRevenue = orders.filter(o => o.status === "pending").reduce((sum, o) => sum + (o.total || 0), 0);
        const totalOrders = orders.length;
        const completedOrders = orders.filter(o => o.status === "delivered" || o.status === "confirmed").length;
        const pendingOrders = orders.filter(o => o.status === "pending").length;
        const cancelledOrders = orders.filter(o => o.status === "cancelled").length;
        const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

        // Top selling products from order items
        const productSales = {};
        for (const order of orders) {
          if (order.items && Array.isArray(order.items)) {
            for (const item of order.items) {
              const name = item.name || "Unknown";
              if (!productSales[name]) productSales[name] = { qty: 0, revenue: 0 };
              productSales[name].qty += item.qty || 0;
              productSales[name].revenue += (item.price || 0) * (item.qty || 0);
            }
          }
        }
        const topProducts = Object.entries(productSales)
          .sort(([, a], [, b]) => b.revenue - a.revenue)
          .slice(0, 5)
          .map(([name, data]) => ({ name, ...data }));

        // Payment method breakdown
        const paymentBreakdown = {};
        for (const order of orders) {
          const method = order.payment_method || "unknown";
          if (!paymentBreakdown[method]) paymentBreakdown[method] = { count: 0, total: 0 };
          paymentBreakdown[method].count++;
          paymentBreakdown[method].total += order.total || 0;
        }

        // Inventory summary
        const activeProducts = products?.filter(p => p.status === "active") || [];
        const outOfStock = activeProducts.filter(p => p.stock <= 0).length;
        const lowStock = activeProducts.filter(p => p.stock > 0 && p.stock <= 5).length;
        const totalInventoryValue = activeProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);

        return {
          success: true,
          period: normalizedPeriod,
          startDate: startDate.toISOString(),
          generatedAt: now.toISOString(),
          revenue: {
            total: totalRevenue,
            completed: completedRevenue,
            pending: pendingRevenue,
          },
          orders: {
            total: totalOrders,
            completed: completedOrders,
            pending: pendingOrders,
            cancelled: cancelledOrders,
            avgValue: avgOrderValue,
          },
          topProducts,
          paymentBreakdown,
          inventory: {
            activeProducts: activeProducts.length,
            outOfStock,
            lowStock,
            totalInventoryValue,
          },
          _action: { type: "navigate", path: "/dashboard/analytics", label: "View Full Analytics" },
        };
      },
    }),

    get_latest_sales: tool({
      description: "Get the most recent sales/orders with details. Use when the seller asks about recent sales, latest orders, or what sold recently.",
      inputSchema: z.object({
        limit: z.string().optional().describe("Number of recent sales to fetch (default 10)"),
      }),
      execute: async ({ limit }) => {
        const limitNum = parseInt(limit) || 10;
        const { data, error } = await supabase
          .from("orders")
          .select("id, order_number, total, status, created_at, items, payment_method, customers(name)")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false })
          .limit(limitNum);

        if (error) return { success: false, error: "Failed to fetch recent sales" };
        return {
          success: true,
          sales: data,
          _action: { type: "navigate", path: "/dashboard/orders", label: "View All Orders" },
        };
      },
    }),

    // ─── PRODUCT TOOLS ───

    get_top_products: tool({
      description: "Get the store's products to analyze inventory or top sellers.",
      inputSchema: z.object({
        limit: z.string().optional().describe("Number of products to fetch (default 5)"),
      }),
      execute: async ({ limit }) => {
        const limitNum = parseInt(limit) || 5;
        const { data, error } = await supabase
          .from("products")
          .select("id, name, price, stock, category, status")
          .eq("account_id", accountId)
          .eq("status", "active")
          .limit(limitNum);

        if (error) return { success: false, error: "Failed to fetch products" };
        return {
          success: true,
          products: data,
          _action: { type: "navigate", path: "/dashboard/products", label: "View All Products" },
        };
      },
    }),

    create_product: tool({
      description: "Create a new product in the store. Use this when the seller asks to add a new product. You should ask for at least the product name and price. Generate a compelling description if the seller provides a brief prompt. After creating, tell the user the product was added and suggest they can view it in the Products page.",
      inputSchema: z.object({
        name: z.string().describe("Product name"),
        description: z.string().optional().describe("Product description (generate a compelling one if not provided)"),
        price: z.string().describe("Product price"),
        stock: z.string().optional().describe("Initial stock quantity (default 0)"),
        category: z.string().optional().describe("Product category (default 'General')"),
      }),
      execute: async ({ name, description, price, stock, category }) => {
        if (!name) {
          return { success: false, error: "Product name is required" };
        }
        const priceNum = parseFloat(price);
        if (isNaN(priceNum)) {
          return { success: false, error: "Product price is required and must be a number" };
        }
        const { data, error } = await supabase
          .from("products")
          .insert({
            account_id: accountId,
            name,
            description: description || "",
            price: priceNum,
            stock: parseInt(stock) || 0,
            category: category || "General",
            status: "active",
          })
          .select("id, name, price, stock, category")
          .single();

        if (error) return { success: false, error: `Failed to create product: ${error.message}` };
        return {
          success: true,
          message: `Product "${name}" created successfully!`,
          product: data,
          _action: { type: "navigate", path: "/dashboard/products", label: "Go to Products" },
        };
      },
    }),

    generate_product_image: tool({
      description: "Generate a professional product image using AI. Use this AFTER creating a product, when the seller wants an AI-generated image for their product. Also use when the seller explicitly asks to generate or create an image for a product. The image will be uploaded and linked to the product.",
      inputSchema: z.object({
        product_id: z.string().describe("The ID of the product to generate an image for"),
        product_name: z.string().describe("The name of the product"),
        description: z.string().optional().describe("Product description to help generate a relevant image"),
        style: z.string().optional().describe("Image style: 'studio' (clean white background, professional), 'lifestyle' (product in use, contextual), 'minimal' (simple, elegant). Default: studio"),
      }),
      execute: async ({ product_id, product_name, description, style }) => {
        try {
          const styleStr = style?.toLowerCase()?.trim() || "studio";
          const stylePrompt = {
            studio: "professional product photography on clean white background, studio lighting, high-end e-commerce style, centered composition, sharp focus",
            lifestyle: "lifestyle product photography, product shown in realistic use context, warm natural lighting, appealing scene, soft shadows",
            minimal: "minimalist product photography, simple elegant composition, soft neutral gradient background, refined and modern aesthetic",
          }[styleStr] || "professional product photography on clean white background, studio lighting, high-end e-commerce style";

          // Build the image generation prompt
          const prompt = `${stylePrompt}. Product: ${product_name}${description ? `. ${description}` : ""}. High quality, 4K, commercial photography, no text, no watermark, no people visible.`;

          // Generate image using shared utility (ZAI first, then Google Imagen fallback)
          const genResult = await generateProductImage(prompt, { size: "1024x1024" });

          if (!genResult.success) {
            return {
              success: false,
              error: genResult.error || "Image generation failed. The AI image service may be temporarily unavailable.",
            };
          }

          const imageBase64 = genResult.imageBase64;
          console.log(`[Agent] Image generated for "${product_name}" via ${genResult.source}`);

          // Convert base64 to buffer for upload
          const imageBuffer = Buffer.from(imageBase64, "base64");

          // Upload to Supabase Storage
          // Path format: {user_id}/{filename} to match RLS policies
          const storagePath = `${accountId}/${product_id}-${Date.now()}.png`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(storagePath, imageBuffer, {
              contentType: "image/png",
              upsert: true,
            });

          if (uploadError) {
            console.error("[Agent] Supabase storage upload failed:", uploadError.message);
            // If storage fails, save base64 data URL directly to product
            const dataUrl = `data:image/png;base64,${imageBase64}`;
            await supabase
              .from("products")
              .update({ image_urls: [dataUrl] })
              .eq("id", product_id)
              .eq("account_id", accountId);
            return {
              success: true,
              message: `Image generated for "${product_name}" but cloud upload failed. Image saved directly.`,
              image_url: dataUrl,
              product_id,
              _action: { type: "navigate", path: "/dashboard/products", label: "View Product" },
            };
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("product-images")
            .getPublicUrl(storagePath);

          const imageUrl = urlData?.publicUrl;

          // Update product with image URL (use image_urls array to match products page)
          const { error: updateError } = await supabase
            .from("products")
            .update({ image_urls: [imageUrl] })
            .eq("id", product_id)
            .eq("account_id", accountId);

          if (updateError) {
            console.error("[Agent] Failed to update product image_url:", updateError.message);
          }

          return {
            success: true,
            message: `Product image generated for "${product_name}" and uploaded successfully!`,
            image_url: imageUrl,
            product_id,
            _action: { type: "navigate", path: "/dashboard/products", label: "View Product" },
          };
        } catch (error) {
          console.error("[Agent] generate_product_image error:", error);
          return {
            success: false,
            error: `Failed to generate product image: ${error.message}`,
          };
        }
      },
    }),

    update_product: tool({
      description: "Update an existing product's details (name, price, stock, description, category). Use when the seller wants to edit or modify a product. You need the product ID.",
      inputSchema: z.object({
        product_id: z.string().describe("The ID of the product to update"),
        name: z.string().optional().describe("New product name"),
        price: z.string().optional().describe("New product price"),
        stock: z.string().optional().describe("New stock quantity"),
        description: z.string().optional().describe("New product description"),
        category: z.string().optional().describe("New product category"),
      }),
      execute: async ({ product_id, name, price, stock, description, category }) => {
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (price !== undefined) { const p = parseFloat(price); if (!isNaN(p)) updates.price = p; }
        if (stock !== undefined) { const s = parseInt(stock); if (!isNaN(s)) updates.stock = s; }
        if (description !== undefined) updates.description = description;
        if (category !== undefined) updates.category = category;

        if (Object.keys(updates).length === 0) {
          return { success: false, error: "No fields provided to update" };
        }

        const { data, error } = await supabase
          .from("products")
          .update(updates)
          .eq("id", product_id)
          .eq("account_id", accountId)
          .select("id, name, price, stock, category")
          .single();

        if (error) return { success: false, error: `Failed to update product: ${error.message}` };
        if (!data) return { success: false, error: "Product not found" };
        return {
          success: true,
          message: `Product "${data.name}" updated successfully!`,
          product: data,
          _action: { type: "navigate", path: "/dashboard/products", label: "Go to Products" },
        };
      },
    }),

    draft_product_description: tool({
      description: "Draft an SEO-optimized product description based on basic details provided by the seller. Returns a drafted description for the seller to review.",
      inputSchema: z.object({
        product_name: z.string().optional().describe("The name of the product"),
        features: z.string().describe("Key features or keywords to include"),
        tone: z.string().optional().describe("The tone of the description (e.g., professional, fun, luxurious)"),
      }),
      execute: async ({ product_name, features, tone }) => {
        const finalName = product_name || "Unnamed Product";
        const toneStr = tone || "professional";
        return {
          success: true,
          message: `I will write a ${toneStr} description for "${finalName}" highlighting: ${features}. (Please format the final output nicely using markdown).`,
        };
      },
    }),

    // ─── INVENTORY & ORDER TOOLS ───

    get_inventory_alerts: tool({
      description: "Get inventory alerts for low-stock and out-of-stock products. Use when the seller asks about inventory issues, stock alerts, or products that need restocking.",
      inputSchema: z.object({
        threshold: z.string().optional().describe("Low stock threshold (default 5)"),
      }),
      execute: async ({ threshold }) => {
        const lowStockThreshold = parseInt(threshold) || 5;
        const { data: products, error } = await supabase
          .from("products")
          .select("id, name, price, stock, category, status")
          .eq("account_id", accountId)
          .eq("status", "active");

        if (error) return { success: false, error: "Failed to fetch inventory" };

        const outOfStock = products.filter(p => p.stock <= 0);
        const lowStock = products.filter(p => p.stock > 0 && p.stock <= lowStockThreshold);
        const healthy = products.filter(p => p.stock > lowStockThreshold);

        return {
          success: true,
          outOfStock: outOfStock.map(p => ({ id: p.id, name: p.name, stock: p.stock, category: p.category })),
          lowStock: lowStock.map(p => ({ id: p.id, name: p.name, stock: p.stock, category: p.category })),
          healthyCount: healthy.length,
          totalActiveProducts: products.length,
          _action: { type: "navigate", path: "/dashboard/products", label: "Manage Products" },
        };
      },
    }),

    search_products: tool({
      description: "Search products by name, category, or status. Use when the seller asks to find specific products or filter their catalog.",
      inputSchema: z.object({
        query: z.string().optional().describe("Search term for product name"),
        category: z.string().optional().describe("Filter by category"),
        status: z.string().optional().describe("Filter by status (active, draft, archived)"),
        limit: z.string().optional().describe("Max results (default 20)"),
      }),
      execute: async ({ query, category, status, limit }) => {
        const limitNum = parseInt(limit) || 20;
        let dbQuery = supabase
          .from("products")
          .select("id, name, price, stock, category, status, created_at")
          .eq("account_id", accountId)
          .limit(limitNum);

        if (query) dbQuery = dbQuery.ilike("name", `%${query}%`);
        if (category) dbQuery = dbQuery.eq("category", category);
        if (status) dbQuery = dbQuery.eq("status", status);

        const { data, error } = await dbQuery;
        if (error) return { success: false, error: "Failed to search products" };
        return {
          success: true,
          products: data,
          count: data.length,
          _action: { type: "navigate", path: "/dashboard/products", label: "View All Products" },
        };
      },
    }),

    update_order_status: tool({
      description: "Update the status of an order. Use when the seller wants to change an order's status. Valid statuses: pending, confirmed, shipped, delivered, cancelled.",
      inputSchema: z.object({
        order_id: z.string().describe("The ID of the order to update"),
        status: z.string().describe("New order status. Must be one of: pending, confirmed, shipped, delivered, cancelled"),
      }),
      execute: async ({ order_id, status }) => {
        const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
        const normalizedStatus = validStatuses.find(s => s === status?.toLowerCase()?.trim()) || status;
        const { data, error } = await supabase
          .from("orders")
          .update({ status: normalizedStatus })
          .eq("id", order_id)
          .eq("account_id", accountId)
          .select("id, order_number, status, total")
          .single();

        if (error) return { success: false, error: `Failed to update order: ${error.message}` };
        if (!data) return { success: false, error: "Order not found" };
        return {
          success: true,
          message: `Order #${data.order_number || data.id} status updated to "${normalizedStatus}"`,
          order: data,
          _action: { type: "navigate", path: "/dashboard/orders", label: "View Orders" },
        };
      },
    }),

    delete_product: tool({
      description: "Delete (archive) a product from the store. Sets its status to 'archived' instead of hard deleting. Use when the seller wants to remove a product.",
      inputSchema: z.object({
        product_id: z.string().describe("The ID of the product to delete"),
      }),
      execute: async ({ product_id }) => {
        const { data, error } = await supabase
          .from("products")
          .update({ status: "archived" })
          .eq("id", product_id)
          .eq("account_id", accountId)
          .select("id, name, status")
          .single();

        if (error) return { success: false, error: `Failed to delete product: ${error.message}` };
        if (!data) return { success: false, error: "Product not found" };
        return {
          success: true,
          message: `Product "${data.name}" has been archived.`,
          product: data,
          _action: { type: "navigate", path: "/dashboard/products", label: "Go to Products" },
        };
      },
    }),

    // ─── CONVERSATION TOOLS ───

    get_recent_conversations: tool({
      description: "Get a summary of recent active conversations and their status. Use when the seller asks about their messages or customer interactions.",
      inputSchema: z.object({
        limit: z.string().optional().describe("Number of conversations to fetch (default 5)"),
      }),
      execute: async ({ limit }) => {
        const limitNum = parseInt(limit) || 5;
        const { data, error } = await supabase
          .from("conversations")
          .select("id, channel, status, unread_count, updated_at, customers(name)")
          .eq("account_id", accountId)
          .order("updated_at", { ascending: false })
          .limit(limitNum);

        if (error) return { success: false, error: "Failed to fetch conversations" };
        return {
          success: true,
          conversations: data,
          _action: { type: "navigate", path: "/dashboard/conversations", label: "View Conversations" },
        };
      },
    }),

    send_message_to_customer: tool({
      description: "Send a message directly to a customer through their conversation channel (WhatsApp, Instagram, or Facebook). Use this when the seller asks you to send a message to a customer, reply to a customer, reach out to someone, or notify a customer. You need the conversation ID and the message content. The message will be delivered through the actual channel (WhatsApp, Instagram DM, or Facebook Messenger) AND saved in the database.",
      inputSchema: z.object({
        conversation_id: z.string().describe("The ID of the conversation to send the message to"),
        message: z.string().describe("The message content to send to the customer"),
      }),
      execute: async ({ conversation_id, message }) => {
        try {
          if (!conversation_id || !message) {
            return { success: false, error: "Conversation ID and message content are required" };
          }

          // ─── Direct delivery: no HTTP fetch to self ───
          // Previously this tool made a fetch to /api/messages/send which could fail
          // on Vercel (DNS resolution, cold starts, timeouts). Now we call the
          // Meta/WhatsApp APIs directly, just like send_follow_up does.

          // 1. Look up the conversation + customer + account info
          const { data: conversation, error: convError } = await supabase
            .from("conversations")
            .select("id, channel, account_id, customer:customers(id, name, platform_id, phone)")
            .eq("id", conversation_id)
            .single();

          if (convError || !conversation) {
            return { success: false, error: `Conversation not found: ${convError?.message || 'unknown'}` };
          }

          const { account_id, channel, customer } = conversation;
          const recipientId = customer?.platform_id;
          const customerName = customer?.name || 'Customer';

          // 2. Get the account's channel tokens
          const { data: accountData, error: accountError } = await supabase
            .from("accounts")
            .select("whatsapp_access_token, whatsapp_phone_number_id, whatsapp_connected, instagram_access_token, instagram_page_id, facebook_access_token, facebook_page_id")
            .eq("id", account_id)
            .single();

          if (accountError || !accountData) {
            return { success: false, error: "Account not found" };
          }

          // 3. Deliver the message through the actual channel
          let delivered = false;
          let deliveryError = null;

          if (channel === "whatsapp") {
            if (!accountData.whatsapp_connected || !accountData.whatsapp_access_token) {
              return { success: false, error: "WhatsApp is not connected. Please connect WhatsApp in Settings to send messages." };
            }
            const phone = customer?.phone || customer?.platform_id;
            if (!phone) {
              return { success: false, error: "Customer has no phone number for WhatsApp delivery." };
            }
            try {
              const { sendWhatsAppMessage } = await import("@/lib/whatsapp");
              await sendWhatsAppMessage({
                to: phone,
                message,
                phoneNumberId: accountData.whatsapp_phone_number_id,
                accessToken: accountData.whatsapp_access_token,
              });
              delivered = true;
            } catch (e) {
              deliveryError = e.message;
              console.error("[send_message_to_customer] WhatsApp delivery failed:", e.message);
            }
          } else if (channel === "instagram") {
            if (!recipientId) {
              return { success: false, error: "Customer has no Instagram platform ID for delivery." };
            }
            if (!accountData.instagram_access_token || !accountData.instagram_page_id) {
              return { success: false, error: "Instagram is not connected. Please connect Instagram in Settings to send messages." };
            }
            try {
              const { sendMessage } = await import("@/lib/channels/meta");
              await sendMessage({
                recipientId,
                message,
                pageId: accountData.instagram_page_id,
                accessToken: accountData.instagram_access_token,
              });
              delivered = true;
            } catch (e) {
              deliveryError = e.message;
              console.error("[send_message_to_customer] Instagram delivery failed:", e.message);
            }
          } else if (channel === "facebook") {
            if (!recipientId) {
              return { success: false, error: "Customer has no Facebook platform ID for delivery." };
            }
            if (!accountData.facebook_access_token || !accountData.facebook_page_id) {
              return { success: false, error: "Facebook is not connected. Please connect Facebook in Settings to send messages." };
            }
            try {
              const { sendMessage } = await import("@/lib/channels/meta");
              await sendMessage({
                recipientId,
                message,
                pageId: accountData.facebook_page_id,
                accessToken: accountData.facebook_access_token,
              });
              delivered = true;
            } catch (e) {
              deliveryError = e.message;
              console.error("[send_message_to_customer] Facebook delivery failed:", e.message);
            }
          } else {
            return { success: false, error: `Unknown channel: ${channel}. Cannot deliver message.` };
          }

          // 4. Store the outgoing message in the database (always, even if delivery failed)
          const { error: insertError } = await supabase.from("messages").insert({
            conversation_id,
            account_id,
            direction: "outgoing",
            content: message,
            type: "text",
            is_ai: true,
            delivery_status: delivered ? "delivered" : "failed",
          });

          if (insertError) {
            console.error("[send_message_to_customer] Failed to store message:", insertError.message);
          }

          // 5. Update conversation metadata
          await supabase
            .from("conversations")
            .update({
              last_message_at: new Date().toISOString(),
              status: "waiting_customer",
            })
            .eq("id", conversation_id);

          // 6. Return result
          if (!delivered) {
            return {
              success: false,
              error: `Message was saved but could NOT be delivered to ${customerName} on ${channel}: ${deliveryError || 'Channel not connected'}. The message is stored in the conversation and the customer may see it when they message again. Try reconnecting ${channel} in Settings.`,
              conversation_id,
              _action: { type: "navigate", path: "/dashboard/conversations", label: "View Conversation" },
            };
          }

          return {
            success: true,
            message: `Message delivered to ${customerName} on ${channel} successfully!`,
            conversation_id,
            channel,
            _action: { type: "navigate", path: "/dashboard/conversations", label: "View Conversation" },
          };
        } catch (err) {
          console.error("[send_message_to_customer] Unexpected error:", err);
          return { success: false, error: `Failed to send message: ${err.message}` };
        }
      },
    }),

    find_conversation: tool({
      description: "Find a conversation by customer name or channel. Use this when the seller wants to send a message to a specific customer but doesn't know the conversation ID. Returns matching conversations with their IDs.",
      inputSchema: z.object({
        customer_name: z.string().optional().describe("Customer name to search for"),
        channel: z.string().optional().describe("Channel to filter by (whatsapp, instagram, facebook)"),
        status: z.string().optional().describe("Conversation status to filter by (new, open, in_progress, waiting_customer)"),
        limit: z.string().optional().describe("Max results (default 10)"),
      }),
      execute: async ({ customer_name, channel, status, limit }) => {
        const limitNum = parseInt(limit) || 10;

        let query = supabase
          .from("conversations")
          .select("id, channel, status, unread_count, updated_at, customers(id, name, platform_id)")
          .eq("account_id", accountId)
          .order("updated_at", { ascending: false })
          .limit(limitNum);

        if (channel) query = query.eq("channel", channel);
        if (status) query = query.eq("status", status);

        const { data, error } = await query;

        if (error) return { success: false, error: "Failed to search conversations" };

        // If customer name is provided, filter results
        let results = data || [];
        if (customer_name) {
          const nameLower = customer_name.toLowerCase();
          results = results.filter(c =>
            c.customers?.name?.toLowerCase().includes(nameLower)
          );
        }

        return {
          success: true,
          conversations: results.map(c => ({
            id: c.id,
            channel: c.channel,
            status: c.status,
            unread_count: c.unread_count,
            customer_name: c.customers?.name || "Unknown",
            updated_at: c.updated_at,
          })),
          count: results.length,
          _action: { type: "navigate", path: "/dashboard/conversations", label: "View Conversations" },
        };
      },
    }),

    // ─── CUSTOMER TOOLS ───

    get_order_details: tool({
      description: "Get detailed information about a specific order, including items, customer info, and payment details. Use when the seller asks about a specific order.",
      inputSchema: z.object({
        order_id: z.string().describe("The ID of the order"),
      }),
      execute: async ({ order_id }) => {
        const { data, error } = await supabase
          .from("orders")
          .select("id, order_number, total, status, items, payment_method, created_at, shipping_address, customers(name, email, phone)")
          .eq("id", order_id)
          .eq("account_id", accountId)
          .single();

        if (error) return { success: false, error: "Order not found" };
        return {
          success: true,
          order: data,
          _action: { type: "navigate", path: "/dashboard/orders", label: "View All Orders" },
        };
      },
    }),

    get_customer_insights: tool({
      description: "Get customer analytics and insights — total customers, returning customers, top spenders, and customer distribution. Use when the seller asks about their customers or wants customer analytics. Takes no required parameters.",
      inputSchema: z.object({
        summary: z.string().optional().describe("Set to 'true' for a brief summary, or omit for full details"),
      }),
      execute: async ({ summary }) => {
        const { data: customers, error } = await supabase
          .from("customers")
          .select("id, name, total_orders, total_spent, is_returning, channel, created_at")
          .eq("account_id", accountId)
          .order("total_spent", { ascending: false });

        if (error) return { success: false, error: "Failed to fetch customer data" };

        const totalCustomers = customers.length;
        const returningCustomers = customers.filter(c => c.is_returning).length;
        const totalSpent = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
        const avgSpend = totalCustomers > 0 ? Math.round(totalSpent / totalCustomers) : 0;
        const topSpenders = customers.slice(0, 5).map(c => ({
          name: c.name,
          total_spent: c.total_spent,
          total_orders: c.total_orders,
        }));

        // Channel distribution
        const channelDist = {};
        for (const c of customers) {
          const ch = c.channel || "unknown";
          channelDist[ch] = (channelDist[ch] || 0) + 1;
        }

        return {
          success: true,
          totalCustomers,
          returningCustomers,
          totalSpent,
          avgSpend,
          topSpenders,
          channelDistribution: channelDist,
          _action: { type: "navigate", path: "/dashboard/customers", label: "View Customers" },
        };
      },
    }),

    // ─── AI AUTOMATION TOOLS ───

    recommend_products: tool({
      description: "Recommend products based on customer needs or context. Use when the seller wants to find products matching a customer's needs, like 'dry skin products' or 'gift ideas'.",
      inputSchema: z.object({
        query: z.string().describe("The need, preference, or context to match products against"),
      }),
      execute: async ({ query }) => {
        if (!query) return { success: false, error: "Query is required" };

        const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

        const { data: products, error } = await supabase
          .from("products")
          .select("id, name, description, price, stock, category")
          .eq("account_id", accountId)
          .eq("status", "active");

        if (error) return { success: false, error: "Failed to search products" };
        if (!products || products.length === 0) return { success: true, products: [] };

        const scored = products.map((product) => {
          let score = 0;
          const nameLower = (product.name || "").toLowerCase();
          const descLower = (product.description || "").toLowerCase();
          const catLower = (product.category || "").toLowerCase();
          const allText = `${nameLower} ${descLower} ${catLower}`;

          for (const term of searchTerms) {
            if (nameLower.includes(term)) score += 10;
            if (catLower.includes(term)) score += 8;
            if (descLower.includes(term)) score += 5;
            if (allText.includes(term)) score += 2;
          }

          if (product.stock > 0) score += 3;
          return { ...product, score };
        });

        const recommendations = scored
          .filter((p) => p.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        return {
          success: true,
          query,
          products: recommendations.map(({ score, ...rest }) => rest),
          _action: { type: "navigate", path: "/dashboard/products", label: "View Products" },
        };
      },
    }),

    send_follow_up: tool({
      description: "Send a follow-up message to customers with unpaid orders older than 24 hours. Use when the seller wants to follow up on pending orders or asks about unpaid orders. Messages are sent through the actual channel (WhatsApp/IG/FB), not just saved to DB.",
      inputSchema: z.object({
        order_id: z.string().optional().describe("Specific order ID to follow up on (optional, if omitted follows up on all unpaid orders)"),
      }),
      execute: async ({ order_id }) => {
        try {
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

          let query = supabase
            .from("orders")
            .select("id, order_number, total, items, customer_id, payment_status")
            .eq("account_id", accountId)
            .eq("payment_status", "unpaid")
            .in("status", ["pending", "confirmed"])
            .lt("created_at", twentyFourHoursAgo);

          if (order_id) query = query.eq("id", order_id);

          const { data: unpaidOrders, error } = await query;

          if (error) return { success: false, error: "Failed to fetch unpaid orders" };
          if (!unpaidOrders || unpaidOrders.length === 0) {
            return { success: true, message: "No unpaid orders older than 24h found", sent: 0 };
          }

          // Get account channel tokens for sending messages
          const { data: accountData } = await supabase
            .from("accounts")
            .select("whatsapp_access_token, whatsapp_phone_number_id, whatsapp_connected, instagram_access_token, instagram_page_id, facebook_access_token, facebook_page_id")
            .eq("id", accountId)
            .single();

          let sent = 0;
          let failedDeliveries = 0;
          for (const order of unpaidOrders) {
            const { data: conversation } = await supabase
              .from("conversations")
              .select("id, channel, customer_id")
              .eq("account_id", accountId)
              .eq("customer_id", order.customer_id)
              .in("status", ["new", "open", "in_progress", "waiting_customer"])
              .order("last_message_at", { ascending: false })
              .limit(1)
              .single();

            if (!conversation) continue;

            const { data: customer } = await supabase
              .from("customers")
              .select("id, platform_id, phone")
              .eq("id", order.customer_id)
              .single();

            const itemsSummary = (order.items || []).map(i => `${i.qty}x ${i.name}`).join(", ");
            const followUpMessage = `Hi! Just a friendly reminder — your order #${order.order_number} (${itemsSummary}) for ${order.total} EGP is still pending payment. Would you like to complete your order?`;

            // Try to actually deliver through the channel
            let delivered = false;
            try {
              if (conversation.channel === "whatsapp" && accountData?.whatsapp_connected && accountData?.whatsapp_access_token) {
                const { sendWhatsAppMessage } = await import("@/lib/whatsapp");
                const recipientPhone = customer?.phone || customer?.platform_id;
                if (recipientPhone) {
                  await sendWhatsAppMessage({
                    to: recipientPhone,
                    message: followUpMessage,
                    phoneNumberId: accountData.whatsapp_phone_number_id,
                    accessToken: accountData.whatsapp_access_token,
                  });
                  delivered = true;
                }
              } else if (conversation.channel === "instagram" && accountData?.instagram_access_token) {
                const { sendMessage } = await import("@/lib/channels/meta");
                await sendMessage({
                  recipientId: customer?.platform_id,
                  message: followUpMessage,
                  pageId: accountData.instagram_page_id,
                  accessToken: accountData.instagram_access_token,
                });
                delivered = true;
              } else if (conversation.channel === "facebook" && accountData?.facebook_access_token) {
                const { sendMessage } = await import("@/lib/channels/meta");
                await sendMessage({
                  recipientId: customer?.platform_id,
                  message: followUpMessage,
                  pageId: accountData.facebook_page_id,
                  accessToken: accountData.facebook_access_token,
                });
                delivered = true;
              }
            } catch (deliveryErr) {
              console.warn(`[send_follow_up] Delivery failed for order ${order.order_number}:`, deliveryErr.message);
              failedDeliveries++;
            }

            // Store the message in DB regardless of delivery status
            await supabase.from("messages").insert({
              conversation_id: conversation.id,
              account_id: accountId,
              direction: "outgoing",
              content: followUpMessage,
              type: "text",
              is_ai: true,
              delivery_status: delivered ? "delivered" : "failed",
            });

            await supabase
              .from("conversations")
              .update({ last_message_at: new Date().toISOString(), status: "in_progress" })
              .eq("id", conversation.id);

            sent++;
          }

          return {
            success: true,
            message: `Sent ${sent} follow-up messages for unpaid orders${failedDeliveries > 0 ? ` (${failedDeliveries} delivery failures - messages saved to DB)` : ' - all delivered through channel'}`,
            sent,
            total: unpaidOrders.length,
            failedDeliveries,
            _action: { type: "navigate", path: "/dashboard/orders", label: "View Orders" },
          };
        } catch (err) {
          return { success: false, error: `Follow-up failed: ${err.message}` };
        }
      },
    }),

    get_escalated_conversations: tool({
      description: "Get conversations that have been flagged with negative sentiment or need human attention. Use when the seller asks about angry customers, escalation, or conversations that need attention.",
      inputSchema: z.object({
        limit: z.string().optional().describe("Number of conversations to fetch (default 10)"),
      }),
      execute: async ({ limit }) => {
        const limitNum = parseInt(limit) || 10;

        // Find conversations tagged with negative sentiment or escalation
        const { data: conversations, error } = await supabase
          .from("conversations")
          .select("id, channel, status, tags, summary, unread_count, updated_at, customers(name)")
          .eq("account_id", accountId)
          .or("tags.cs.{sentiment:negative},tags.cs.{sentiment:urgent},tags.cs.{escalated}")
          .order("updated_at", { ascending: false })
          .limit(limitNum);

        if (error) {
          // Fallback: try fetching by negative sentiment messages
          const { data: negativeMessages, error: msgError } = await supabase
            .from("messages")
            .select("conversation_id, content, sentiment")
            .eq("account_id", accountId)
            .in("sentiment", ["negative", "urgent"])
            .order("created_at", { ascending: false })
            .limit(limitNum);

          if (msgError || !negativeMessages || negativeMessages.length === 0) {
            return { success: true, conversations: [], message: "No escalated conversations found" };
          }

          const convIds = [...new Set(negativeMessages.map(m => m.conversation_id))];
          const { data: convData } = await supabase
            .from("conversations")
            .select("id, channel, status, tags, summary, unread_count, updated_at, customers(name)")
            .in("id", convIds)
            .eq("account_id", accountId);

          return {
            success: true,
            conversations: convData || [],
            _action: { type: "navigate", path: "/dashboard/conversations", label: "View Conversations" },
          };
        }

        return {
          success: true,
          conversations: conversations || [],
          _action: { type: "navigate", path: "/dashboard/conversations", label: "View Conversations" },
        };
      },
    }),

    generate_description: tool({
      description: "Generate an AI product description in English and Arabic with a price suggestion. Use when the seller wants to generate or create a product description, or when they want a compelling writeup for a product.",
      inputSchema: z.object({
        product_name: z.string().describe("The name of the product"),
        features: z.string().describe("Key features or keywords to include in the description"),
        category: z.string().optional().describe("Product category"),
        tone: z.string().optional().describe("Description tone (e.g. professional, fun, luxurious)"),
      }),
      execute: async ({ product_name, features, category, tone }) => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai/generate-description`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              product_name,
              features,
              category: category || "General",
              tone: tone || "professional",
            }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            return { success: false, error: data.error || "Description generation failed" };
          }

          return {
            success: true,
            english: data.english,
            arabic: data.arabic,
            price_suggestion: data.price_suggestion,
            _action: { type: "navigate", path: "/dashboard/products", label: "Go to Products" },
          };
        } catch (err) {
          return { success: false, error: `Description generation failed: ${err.message}` };
        }
      },
    }),

    summarize_conversation: tool({
      description: "Generate a summary of a customer conversation. Use when the seller wants a quick overview of what happened in a conversation, or asks 'what did this customer ask about?' or 'summarize this chat'.",
      inputSchema: z.object({
        conversation_id: z.string().describe("The ID of the conversation to summarize"),
      }),
      execute: async ({ conversation_id }) => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai/summarize-conversation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversation_id }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            return { success: false, error: data.error || "Summarization failed" };
          }

          return {
            success: true,
            summary: data.summary,
            customer_name: data.customer_name,
            _action: { type: "navigate", path: "/dashboard/conversations", label: "View Conversation" },
          };
        } catch (err) {
          return { success: false, error: `Summarization failed: ${err.message}` };
        }
      },
    }),
  };
};
