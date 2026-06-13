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
      description: "Get basic store analytics for a given time period (e.g. recent orders, revenue). Use when the seller asks 'how are my sales?' or wants a quick overview.",
      inputSchema: z.object({
        days: z.string().describe("Number of past days to analyze (default 30)"),
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
        limit: z.string().describe("Number of recent sales to fetch (default 10)"),
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
      description: "Get the store's products to analyze inventory or top sellers. Returns product details including variants (sizes, colors, etc.) if they exist.",
      inputSchema: z.object({
        limit: z.string().describe("Number of products to fetch (default 5)"),
      }),
      execute: async ({ limit }) => {
        const limitNum = parseInt(limit) || 5;
        const { data, error } = await supabase
          .from("products")
          .select("id, name, price, stock, category, status, variants")
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
      description: "Create a new product in the store. Use when the seller asks to add a new product. You should ask for at least the product name and price. If the seller mentions variants (sizes, colors, etc.), include them in the variants array — each variant gets its own price and stock. When variants are provided, the product's base price is set to the lowest variant price, and total stock is the sum of all variant stocks.",
      inputSchema: z.object({
        name: z.string().describe("Product name"),
        price: z.string().describe("Product base price (required if no variants; ignored if variants are provided)"),
        stock: z.string().describe("Initial stock quantity (required if no variants; ignored if variants are provided)"),
        category: z.string().describe("Product category (default General)"),
        description: z.string().describe("Product description (generate a compelling one if not provided)"),
        variants: z.array(z.object({
          name: z.string().describe("Variant name e.g. 'Red / Large' or 'Size M'"),
          sku: z.string().describe("SKU code (pass empty string if none)"),
          price: z.string().describe("Variant price in absolute amount (not offset)"),
          stock: z.string().describe("Variant stock quantity"),
        })).optional().describe("Product variants (sizes, colors, etc). Each variant has its own absolute price and stock. Include when seller mentions multiple sizes, colors, or options."),
      }),
      execute: async ({ name, description, price, stock, category, variants }) => {
        if (!name) {
          return { success: false, error: "Product name is required" };
        }

        const hasVariants = variants && variants.length > 0 && variants.some(v => v.name?.trim());

        // Clean and validate variants
        let cleanVariants = [];
        if (hasVariants) {
          cleanVariants = variants
            .filter(v => v.name?.trim())
            .map(v => ({
              name: v.name.trim(),
              sku: v.sku?.trim() || null,
              price: Number(v.price) || 0,
              stock: Number(v.stock) || 0,
            }));
        }

        // Calculate base price and stock
        let basePrice, baseStock;
        if (cleanVariants.length > 0) {
          basePrice = Math.min(...cleanVariants.map(v => v.price));
          baseStock = cleanVariants.reduce((sum, v) => sum + v.stock, 0);
        } else {
          basePrice = parseFloat(price);
          baseStock = parseInt(stock) || 0;
          if (isNaN(basePrice)) {
            return { success: false, error: "Product price is required and must be a number" };
          }
        }

        const insertData = {
          account_id: accountId,
          name,
          description: description || "",
          price: basePrice,
          stock: baseStock,
          category: category || "General",
          status: "active",
          variants: cleanVariants.length > 0 ? cleanVariants : null,
        };

        const { data, error } = await supabase
          .from("products")
          .insert(insertData)
          .select("id, name, price, stock, category, variants")
          .single();

        if (error) return { success: false, error: `Failed to create product: ${error.message}` };

        let message = `Product "${name}" created successfully!`;
        if (cleanVariants.length > 0) {
          message += ` With ${cleanVariants.length} variant${cleanVariants.length > 1 ? 's' : ''}: ${cleanVariants.map(v => `${v.name} (${v.price} EGP, ${v.stock} in stock)`).join(', ')}.`;
          message += ` Base price: ${basePrice} EGP, total stock: ${baseStock}.`;
        } else {
          message += ` Price: ${basePrice} EGP, Stock: ${baseStock}.`;
        }

        return {
          success: true,
          message,
          product: data,
          _action: { type: "navigate", path: "/dashboard/products", label: "Go to Products" },
        };
      },
    }),

    generate_product_image: tool({
      description: "Generate a professional product image using AI. Use AFTER creating a product, or when the seller explicitly asks for an AI-generated product image.",
      inputSchema: z.object({
        product_id: z.string().describe("The ID of the product to generate an image for"),
        product_name: z.string().describe("The name of the product"),
        description: z.string().optional().describe("Product description for better image context (optional)"),
        style: z.string().describe("Image style: studio, lifestyle, or minimal (default studio)"),
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
      description: "Update an existing product's details. Provide EITHER product_id (UUID) OR product_name to identify the product. If product_name is given instead of a UUID, the tool will search for the product by name automatically. Only pass the fields you want to change — omit any field to leave it unchanged. Supports updating variants (sizes, colors, etc.) — when variants are provided, the product's base price is set to the lowest variant price, and total stock is the sum of all variant stocks. Pass an empty variants array [] to remove all variants from a product.",
      inputSchema: z.object({
        product_id: z.string().optional().describe("The UUID of the product to update. If you don't have the UUID, use product_name instead."),
        product_name: z.string().optional().describe("The name of the product to update (use this if you don't have the product UUID). The tool will search for the product by name."),
        name: z.string().optional().describe("New product name (omit to keep current)"),
        price: z.string().optional().describe("New product price (omit to keep current; ignored if variants are provided)"),
        stock: z.string().optional().describe("New stock quantity (omit to keep current; ignored if variants are provided)"),
        category: z.string().optional().describe("New product category (omit to keep current)"),
        description: z.string().optional().describe("New product description (omit to keep current)"),
        variants: z.array(z.object({
          name: z.string().describe("Variant name e.g. 'Red / Large' or 'Size M'"),
          sku: z.string().describe("SKU code (pass empty string if none)"),
          price: z.string().describe("Variant price in absolute amount (not offset)"),
          stock: z.string().describe("Variant stock quantity"),
        })).optional().describe("Replace ALL variants for this product. Each variant has its own absolute price and stock. Pass [] to remove all variants. Omit this field to keep existing variants unchanged."),
      }),
      execute: async ({ product_id, product_name, name, price, stock, category, description, variants }) => {
        // Resolve the product ID: if product_id looks like a UUID, use it directly;
        // otherwise search by product_name
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let resolvedId = product_id;
        let resolvedByName = false;

        if (!resolvedId || !UUID_REGEX.test(resolvedId)) {
          // Not a valid UUID — try to find by name
          const searchName = product_name || resolvedId; // use product_name, or fall back to whatever was passed as product_id
          if (!searchName || !searchName.trim()) {
            return { success: false, error: "Please provide either a valid product_id (UUID) or a product_name to identify the product." };
          }

          const { data: found, error: findError } = await supabase
            .from("products")
            .select("id, name, stock, price, variants")
            .eq("account_id", accountId)
            .ilike("name", `%${searchName.trim()}%`)
            .limit(5);

          if (findError) return { success: false, error: `Failed to search for product: ${findError.message}` };
          if (!found || found.length === 0) return { success: false, error: `No product found matching "${searchName}". Try searching with search_products first.` };
          if (found.length > 1) {
            return {
              success: false,
              error: `Multiple products match "${searchName}": ${found.map(p => `"${p.name}" (ID: ${p.id})`).join(', ')}. Please use the specific product ID.`,
              matches: found.map(p => ({ id: p.id, name: p.name })),
            };
          }

          resolvedId = found[0].id;
          resolvedByName = true;
          console.log(`[update_product] Resolved "${searchName}" to product ID ${resolvedId}`);
        }

        const updates = {};
        if (name && name.trim()) updates.name = name.trim();
        if (category && category.trim()) updates.category = category.trim();
        if (description && description.trim()) updates.description = description.trim();

        // Handle variants update
        const hasVariantsUpdate = variants !== undefined;
        if (hasVariantsUpdate) {
          // Clean and validate variants
          let cleanVariants = [];
          if (variants && variants.length > 0 && variants.some(v => v.name?.trim())) {
            cleanVariants = variants
              .filter(v => v.name?.trim())
              .map(v => ({
                name: v.name.trim(),
                sku: v.sku?.trim() || null,
                price: Number(v.price) || 0,
                stock: Number(v.stock) || 0,
              }));
          }

          if (cleanVariants.length > 0) {
            updates.variants = cleanVariants;
            updates.price = Math.min(...cleanVariants.map(v => v.price));
            updates.stock = cleanVariants.reduce((sum, v) => sum + v.stock, 0);
          } else {
            // Removing all variants — keep existing price/stock or use provided values
            updates.variants = null;
            if (price && price.trim()) { const p = parseFloat(price); if (!isNaN(p)) updates.price = p; }
            if (stock && stock.trim()) { const s = parseInt(stock); if (!isNaN(s)) updates.stock = s; }
          }
        } else {
          // No variants update — just update price/stock directly
          if (price && price.trim()) { const p = parseFloat(price); if (!isNaN(p)) updates.price = p; }
          if (stock && stock.trim()) { const s = parseInt(stock); if (!isNaN(s)) updates.stock = s; }
        }

        if (Object.keys(updates).length === 0) {
          return { success: false, error: "No fields provided to update" };
        }

        const { data, error } = await supabase
          .from("products")
          .update(updates)
          .eq("id", resolvedId)
          .eq("account_id", accountId)
          .select("id, name, price, stock, category, variants")
          .single();

        if (error) return { success: false, error: `Failed to update product: ${error.message}` };
        if (!data) return { success: false, error: "Product not found" };

        let message = `Product "${data.name}" updated successfully!`;
        if (hasVariantsUpdate && data.variants && data.variants.length > 0) {
          message += ` Now has ${data.variants.length} variant${data.variants.length > 1 ? 's' : ''}: ${data.variants.map(v => `${v.name} (${v.price} EGP, ${v.stock} in stock)`).join(', ')}.`;
          message += ` Base price: ${data.price} EGP, total stock: ${data.stock}.`;
        } else if (hasVariantsUpdate) {
          message += ` Variants removed. Price: ${data.price} EGP, Stock: ${data.stock}.`;
        }

        return {
          success: true,
          message,
          product: data,
          _action: { type: "navigate", path: "/dashboard/products", label: "Go to Products" },
        };
      },
    }),

    draft_product_description: tool({
      description: "Draft an SEO-optimized product description based on basic details provided by the seller.",
      inputSchema: z.object({
        product_name: z.string().describe("The name of the product"),
        features: z.string().describe("Key features or keywords to include"),
        tone: z.string().describe("Description tone (e.g. professional, fun, luxurious, default professional)"),
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
      description: "Get inventory alerts for low-stock and out-of-stock products, including variant-level stock details. Use when the seller asks about inventory issues or stock alerts.",
      inputSchema: z.object({
        threshold: z.string().describe("Low stock threshold (default 5)"),
      }),
      execute: async ({ threshold }) => {
        const lowStockThreshold = parseInt(threshold) || 5;
        const { data: products, error } = await supabase
          .from("products")
          .select("id, name, price, stock, category, status, variants")
          .eq("account_id", accountId)
          .eq("status", "active");

        if (error) return { success: false, error: "Failed to fetch inventory" };

        const outOfStock = products.filter(p => p.stock <= 0);
        const lowStock = products.filter(p => p.stock > 0 && p.stock <= lowStockThreshold);
        const healthy = products.filter(p => p.stock > lowStockThreshold);

        return {
          success: true,
          outOfStock: outOfStock.map(p => ({ id: p.id, name: p.name, stock: p.stock, category: p.category, variants: p.variants })),
          lowStock: lowStock.map(p => ({ id: p.id, name: p.name, stock: p.stock, category: p.category, variants: p.variants })),
          healthyCount: healthy.length,
          totalActiveProducts: products.length,
          _action: { type: "navigate", path: "/dashboard/products", label: "Manage Products" },
        };
      },
    }),

    search_products: tool({
      description: "Search products by name, category, or status. Returns product details including variants (sizes, colors, etc.) if they exist. Use this when the seller asks about a specific product or wants to find a product to update.",
      inputSchema: z.object({
        query: z.string().describe("Search term for product name (pass empty string if not needed)"),
        category: z.string().describe("Filter by category (pass empty string if not needed)"),
        limit: z.string().describe("Max results (default 20)"),
      }),
      execute: async ({ query, category, limit }) => {
        const status = undefined;
        const limitNum = parseInt(limit) || 20;
        let dbQuery = supabase
          .from("products")
          .select("id, name, price, stock, category, status, variants, created_at")
          .eq("account_id", accountId)
          .limit(limitNum);

        if (query && query.trim()) dbQuery = dbQuery.ilike("name", `%${query.trim()}%`);
        if (category && category.trim()) dbQuery = dbQuery.eq("category", category.trim());
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
      description: "Get a summary of recent active conversations and their status.",
      inputSchema: z.object({
        limit: z.string().describe("Number of conversations to fetch (default 5)"),
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
      description: "Send a message to a customer. Use when the seller asks to message, reply to, or notify a customer. Requires conversation_id and message text. The message is delivered through their channel (WhatsApp/IG/FB) and saved in the database.",
      inputSchema: z.object({
        conversation_id: z.string().describe("The conversation ID to send the message to"),
        message: z.string().describe("The message text to send"),
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

          // SECURITY: Verify the conversation belongs to the current account
          if (account_id !== accountId) {
            return { success: false, error: "Conversation does not belong to your account" };
          }

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
      description: "Find a conversation by customer name. Use this when the seller wants to send a message to a specific customer but doesn't know the conversation ID. Returns matching conversations with their IDs.",
      inputSchema: z.object({
        customer_name: z.string().describe("Customer name to search for (required)"),
      }),
      execute: async ({ customer_name }) => {
        const channel = undefined;
        const status = undefined;
        const limit = undefined;
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

    // ─── COMBINED MESSAGING TOOL (single-step, avoids multi-tool failures) ───

    message_customer: tool({
      description: "Send a message to a customer by name. This is the PREFERRED way to message customers — it finds the conversation and sends the message in one step. Use when the seller says 'send a message to [name]', 'tell [name] something', 'remind [name] about something', or 'notify [name]'.",
      inputSchema: z.object({
        customer_name: z.string().describe("The name of the customer to message"),
        message: z.string().describe("The message text to send to the customer"),
      }),
      execute: async ({ customer_name, message }) => {
        try {
          if (!customer_name || !message) {
            return { success: false, error: "Customer name and message are required" };
          }

          // Step 1: Find the conversation by customer name
          const nameLower = customer_name.toLowerCase();
          const { data: conversations, error: convError } = await supabase
            .from("conversations")
            .select("id, channel, status, account_id, customer:customers(id, name, platform_id, phone)")
            .eq("account_id", accountId)
            .order("updated_at", { ascending: false })
            .limit(50);

          if (convError) {
            return { success: false, error: `Failed to search conversations: ${convError.message}` };
          }

          const matches = (conversations || []).filter(c =>
            c.customer?.name?.toLowerCase().includes(nameLower)
          );

          if (matches.length === 0) {
            return {
              success: false,
              error: `No conversation found for customer "${customer_name}". Please check the customer name or go to Conversations to find them.`,
              _action: { type: "navigate", path: "/dashboard/conversations", label: "View Conversations" },
            };
          }

          // Prefer active conversations over closed ones
          const activeMatches = matches.filter(c => c.status !== 'closed');
          const conversation = (activeMatches.length > 0 ? activeMatches : matches)[0];
          const conversation_id = conversation.id;
          const { channel, customer } = conversation;
          const recipientId = customer?.platform_id;
          const customerName = customer?.name || customer_name;

          // Step 2: Get account channel tokens
          const { data: accountData, error: accountError } = await supabase
            .from("accounts")
            .select("whatsapp_access_token, whatsapp_phone_number_id, whatsapp_connected, instagram_access_token, instagram_page_id, facebook_access_token, facebook_page_id")
            .eq("id", accountId)
            .single();

          if (accountError || !accountData) {
            return { success: false, error: "Account not found" };
          }

          // Step 3: Deliver the message through the channel
          let delivered = false;
          let deliveryError = null;

          if (channel === "whatsapp") {
            if (!accountData.whatsapp_connected || !accountData.whatsapp_access_token) {
              return { success: false, error: "WhatsApp is not connected. Please connect WhatsApp in Settings to send messages." };
            }
            const phone = customer?.phone || customer?.platform_id;
            if (!phone) {
              return { success: false, error: `Customer ${customerName} has no phone number for WhatsApp delivery.` };
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
              console.error("[message_customer] WhatsApp delivery failed:", e.message);
            }
          } else if (channel === "instagram") {
            if (!recipientId) {
              return { success: false, error: `Customer ${customerName} has no Instagram platform ID for delivery.` };
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
              console.error("[message_customer] Instagram delivery failed:", e.message);
            }
          } else if (channel === "facebook") {
            if (!recipientId) {
              return { success: false, error: `Customer ${customerName} has no Facebook platform ID for delivery.` };
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
              console.error("[message_customer] Facebook delivery failed:", e.message);
            }
          } else {
            return { success: false, error: `Unknown channel: ${channel}. Cannot deliver message.` };
          }

          // Step 4: Store the outgoing message in the database
          const { error: insertError } = await supabase.from("messages").insert({
            conversation_id,
            account_id: accountId,
            direction: "outgoing",
            content: message,
            type: "text",
            is_ai: true,
            delivery_status: delivered ? "delivered" : "failed",
          });

          if (insertError) {
            console.error("[message_customer] Failed to store message:", insertError.message);
          }

          // Step 5: Update conversation metadata
          await supabase
            .from("conversations")
            .update({
              last_message_at: new Date().toISOString(),
              status: "waiting_customer",
            })
            .eq("id", conversation_id);

          // Step 6: Return result
          if (!delivered) {
            return {
              success: false,
              error: `Message saved but could NOT be delivered to ${customerName} on ${channel}: ${deliveryError || 'Channel not connected'}. Try reconnecting ${channel} in Settings.`,
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
          console.error("[message_customer] Unexpected error:", err);
          return { success: false, error: `Failed to send message: ${err.message}` };
        }
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
      description: "Get customer analytics and insights — total customers, returning customers, top spenders, and distribution.",
      inputSchema: z.object({
        summary: z.string().describe("Set to 'true' for brief summary, 'false' for full details"),
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
      description: "Send a follow-up message to customers with unpaid orders older than 24 hours. Use when the seller wants to follow up on pending orders.",
      inputSchema: z.object({
        order_id: z.string().describe("Specific order ID to follow up on, or 'all' for all unpaid orders"),
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

          if (order_id && order_id !== "all") query = query.eq("id", order_id);

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
      description: "Get conversations that have been flagged with negative sentiment or need human attention.",
      inputSchema: z.object({
        limit: z.string().describe("Number of conversations to fetch (default 10)"),
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
      description: "Generate an AI product description in English and Arabic with a price suggestion.",
      inputSchema: z.object({
        product_name: z.string().describe("The name of the product"),
        features: z.string().describe("Key features or keywords to include"),
        category: z.string().describe("Product category (default General)"),
        tone: z.string().describe("Description tone (e.g. professional, fun, luxurious, default professional)"),
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

    // ─── COUPON TOOLS ───

    create_coupon: tool({
      description: "Create a new coupon/discount code for the store. Use when the seller asks to create a coupon, discount code, promo code, or voucher. You need at least the coupon code, type (percentage, fixed, or free_shipping), and value. If the seller says '20% off' use type 'percentage' with value '20'. If they say '50 EGP off' use type 'fixed' with value '50'. If they say 'free shipping' use type 'free_shipping' with value '0'.",
      inputSchema: z.object({
        code: z.string().describe("The coupon code (e.g. 'MAR20', 'SUMMER50'). Will be auto-uppercased."),
        type: z.string().describe("Discount type: 'percentage' for % off, 'fixed' for flat amount off, or 'free_shipping'"),
        value: z.string().describe("Discount value: percentage number (e.g. '20' for 20%), fixed amount (e.g. '50'), or '0' for free_shipping"),
        min_order_value: z.string().optional().describe("Minimum order value to use this coupon (default 0, no minimum)"),
        max_uses: z.string().optional().describe("Maximum number of times this coupon can be used (default unlimited)"),
        expires_at: z.string().optional().describe("Expiration date in ISO format (e.g. '2026-12-31T23:59:59Z'). Default: never expires."),
        applies_to: z.string().optional().describe("What the coupon applies to: 'all' (default), 'specific_products', or 'specific_categories'"),
      }),
      execute: async ({ code, type, value, min_order_value, max_uses, expires_at, applies_to }) => {
        try {
          if (!code || !code.trim()) {
            return { success: false, error: "Coupon code is required" };
          }

          const validTypes = ["percentage", "fixed", "free_shipping"];
          const normalizedType = validTypes.find(t => t === type?.toLowerCase()?.trim());
          if (!normalizedType) {
            return { success: false, error: "Type must be 'percentage', 'fixed', or 'free_shipping'" };
          }

          const numericValue = parseFloat(value);
          if (isNaN(numericValue) || numericValue < 0) {
            return { success: false, error: "Value must be a non-negative number" };
          }
          if (normalizedType === "percentage" && (numericValue > 100 || numericValue < 0)) {
            return { success: false, error: "Percentage value must be between 0 and 100" };
          }

          // Check for duplicate code
          const { data: existing } = await supabase
            .from("coupons")
            .select("id")
            .eq("account_id", accountId)
            .eq("code", code.trim().toUpperCase())
            .maybeSingle();

          if (existing) {
            return { success: false, error: `A coupon with code "${code.trim().toUpperCase()}" already exists` };
          }

          // Check plan limits
          const { data: account } = await supabase
            .from("accounts")
            .select("plan")
            .eq("id", accountId)
            .single();

          const { getPlanLimits, isLimitExceeded } = await import("@/lib/plan-limits");
          const limits = getPlanLimits(account?.plan || "starter");
          const couponLimit = limits.coupons !== undefined ? limits.coupons : 3;

          if (couponLimit !== -1) {
            const { count } = await supabase
              .from("coupons")
              .select("*", { count: "exact", head: true })
              .eq("account_id", accountId);

            if (isLimitExceeded(count || 0, couponLimit)) {
              return {
                success: false,
                error: `Coupon limit reached. Your ${account?.plan || "starter"} plan allows ${couponLimit} coupons. Please upgrade to add more.`,
              };
            }
          }

          const insertData = {
            account_id: accountId,
            code: code.trim().toUpperCase(),
            type: normalizedType,
            value: numericValue,
            min_order_value: min_order_value ? parseFloat(min_order_value) : 0,
            max_uses: max_uses ? parseInt(max_uses) : null,
            starts_at: new Date().toISOString(),
            expires_at: expires_at || null,
            applies_to: applies_to || "all",
            product_ids: [],
            categories: [],
            is_active: true,
            used_count: 0,
          };

          const { data, error } = await supabase
            .from("coupons")
            .insert(insertData)
            .select()
            .single();

          if (error) {
            return { success: false, error: `Failed to create coupon: ${error.message}` };
          }

          // Build human-readable description
          let discountDesc;
          if (normalizedType === "percentage") discountDesc = `${numericValue}% off`;
          else if (normalizedType === "fixed") discountDesc = `${numericValue} off`;
          else discountDesc = "Free shipping";

          let conditions = [];
          if (data.min_order_value > 0) conditions.push(`min order ${data.min_order_value}`);
          if (data.max_uses !== null) conditions.push(`limited to ${data.max_uses} uses`);
          if (data.expires_at) conditions.push(`expires ${new Date(data.expires_at).toLocaleDateString()}`);
          if (data.applies_to !== "all") conditions.push(`applies to ${data.applies_to}`);

          const conditionText = conditions.length > 0 ? ` Conditions: ${conditions.join(", ")}.` : "";

          return {
            success: true,
            message: `Coupon "${data.code}" created successfully! ${discountDesc}.${conditionText}`,
            coupon: data,
            _action: { type: "navigate", path: "/dashboard/coupons", label: "View Coupons" },
          };
        } catch (err) {
          console.error("[create_coupon] Error:", err);
          return { success: false, error: `Failed to create coupon: ${err.message}` };
        }
      },
    }),

    list_coupons: tool({
      description: "List all coupons for the store. Use when the seller asks about their coupons, discount codes, or wants to see what promotions are active.",
      inputSchema: z.object({
        status: z.string().optional().describe("Filter by status: 'active', 'expired', or 'all' (default 'all')"),
      }),
      execute: async ({ status }) => {
        const statusFilter = status?.toLowerCase()?.trim() || "all";
        let query = supabase
          .from("coupons")
          .select("*")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false });

        if (statusFilter === "active") {
          query = query.eq("is_active", true);
        }

        const { data, error } = await query;

        if (error) return { success: false, error: "Failed to fetch coupons" };

        let coupons = data || [];

        if (statusFilter === "expired") {
          coupons = coupons.filter(c => c.expires_at && new Date(c.expires_at) < new Date());
        }

        const { data: accountData } = await supabase
          .from("accounts")
          .select("currency")
          .eq("id", accountId)
          .single();
        const currency = accountData?.currency || "EGP";

        const formatted = coupons.map(c => {
          let desc;
          if (c.type === "percentage") desc = `${c.value}% off`;
          else if (c.type === "fixed") desc = `${c.value} ${currency} off`;
          else desc = "Free shipping";

          return {
            code: c.code,
            discount: desc,
            type: c.type,
            value: c.value,
            is_active: c.is_active,
            used_count: c.used_count,
            max_uses: c.max_uses,
            expires_at: c.expires_at,
            applies_to: c.applies_to,
          };
        });

        return {
          success: true,
          coupons: formatted,
          total: formatted.length,
          _action: { type: "navigate", path: "/dashboard/coupons", label: "View Coupons" },
        };
      },
    }),

    navigate_to: tool({
      description: "Navigate the seller to a specific page or tab in the Sellora dashboard. Use this when the seller asks to go to a page, wants to be taken to a setting, or says 'take me there' / 'go to X'. Common paths: /dashboard/settings?tab=security (2FA, password), /dashboard/settings?tab=channels (WhatsApp, Instagram, Facebook), /dashboard/settings?tab=profile (business name, currency), /dashboard/settings?tab=faqs (FAQs), /dashboard/settings?tab=autoreplies (auto-replies), /dashboard/settings?tab=quickreplies (quick replies), /dashboard/settings?tab=automation (automation), /dashboard/settings?tab=webhooks (webhooks), /dashboard/settings?tab=team (team members), /dashboard/settings?tab=notifications (notifications), /dashboard/settings?tab=policies (policies), /dashboard/ai-personality (AI personality), /dashboard/products (products), /dashboard/orders (orders), /dashboard/conversations (conversations), /dashboard/customers (customers), /dashboard/analytics (analytics), /dashboard/coupons (coupons), /dashboard/campaigns (campaigns), /dashboard/billing (billing), /dashboard/automation (automation), /dashboard/abandoned-carts (abandoned carts), /dashboard/segments (segments), /dashboard/shipping (shipping), /dashboard/webhooks (webhooks), /dashboard/stores (stores), /dashboard/notifications (notifications), /dashboard/whatsapp-catalog (WhatsApp catalog).",
      inputSchema: z.object({
        path: z.string().describe("The dashboard path to navigate to, e.g. /dashboard/settings?tab=security"),
        label: z.string().describe("A short label for the navigation button, e.g. 'Go to Security Settings'"),
      }),
      execute: async ({ path, label }) => {
        return {
          success: true,
          message: `Navigating to ${label}...`,
          _action: { type: "navigate", path, label },
        };
      },
    }),
  };
};
