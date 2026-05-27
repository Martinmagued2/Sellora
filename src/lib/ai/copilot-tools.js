import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const createCopilotTools = (accountId) => {
  return {
    // ─── ANALYTICS TOOLS ───

    get_store_analytics: tool({
      description: "Get basic store analytics for a given time period (e.g. recent orders, revenue). Use this when the seller asks 'how are my sales?' or wants a quick overview.",
      parameters: z.object({
        days: z.number().optional().describe("Number of past days to analyze (default 30)"),
      }),
      execute: async ({ days }) => {
        const daysNum = days || 30;
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
      description: "Generate a detailed sales/income report for the store. Includes revenue breakdown, order stats, top-selling products, and trends. Use when the seller asks for a report, income summary, or detailed sales analysis.",
      parameters: z.object({
        period: z.enum(["today", "week", "month", "quarter", "year"]).describe("The time period for the report"),
      }),
      execute: async ({ period }) => {
        const now = new Date();
        let startDate;

        switch (period) {
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
          period,
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
      parameters: z.object({
        limit: z.number().optional().describe("Number of recent sales to fetch (default 10)"),
      }),
      execute: async ({ limit }) => {
        const limitNum = limit || 10;
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
      parameters: z.object({
        limit: z.number().optional().describe("Number of products to fetch (default 5)"),
      }),
      execute: async ({ limit }) => {
        const limitNum = limit || 5;
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
      parameters: z.object({
        name: z.string().describe("Product name"),
        description: z.string().optional().describe("Product description (generate a compelling one if not provided)"),
        price: z.number().describe("Product price"),
        stock: z.number().optional().describe("Initial stock quantity (default 0)"),
        category: z.string().optional().describe("Product category (default 'General')"),
      }),
      execute: async ({ name, description, price, stock, category }) => {
        if (!name) {
          return { success: false, error: "Product name is required" };
        }
        if (price === undefined || price === null) {
          return { success: false, error: "Product price is required" };
        }
        const { data, error } = await supabase
          .from("products")
          .insert({
            account_id: accountId,
            name,
            description: description || "",
            price,
            stock: stock || 0,
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

    update_product: tool({
      description: "Update an existing product's details (name, price, stock, description, category). Use when the seller wants to edit or modify a product. You need the product ID.",
      parameters: z.object({
        product_id: z.string().describe("The ID of the product to update"),
        name: z.string().optional().describe("New product name"),
        price: z.number().optional().describe("New product price"),
        stock: z.number().optional().describe("New stock quantity"),
        description: z.string().optional().describe("New product description"),
        category: z.string().optional().describe("New product category"),
      }),
      execute: async ({ product_id, name, price, stock, description, category }) => {
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (price !== undefined) updates.price = price;
        if (stock !== undefined) updates.stock = stock;
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
      parameters: z.object({
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
      parameters: z.object({
        threshold: z.number().optional().describe("Low stock threshold (default 5)"),
      }),
      execute: async ({ threshold }) => {
        const lowStockThreshold = threshold || 5;
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
      parameters: z.object({
        query: z.string().optional().describe("Search term for product name"),
        category: z.string().optional().describe("Filter by category"),
        status: z.string().optional().describe("Filter by status (active, draft, archived)"),
        limit: z.number().optional().describe("Max results (default 20)"),
      }),
      execute: async ({ query, category, status, limit }) => {
        const limitNum = limit || 20;
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
      description: "Update the status of an order (e.g. pending, confirmed, shipped, delivered, cancelled). Use when the seller wants to change an order's status.",
      parameters: z.object({
        order_id: z.string().describe("The ID of the order to update"),
        status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]).describe("New order status"),
      }),
      execute: async ({ order_id, status }) => {
        const { data, error } = await supabase
          .from("orders")
          .update({ status })
          .eq("id", order_id)
          .eq("account_id", accountId)
          .select("id, order_number, status, total")
          .single();

        if (error) return { success: false, error: `Failed to update order: ${error.message}` };
        if (!data) return { success: false, error: "Order not found" };
        return {
          success: true,
          message: `Order #${data.order_number || data.id} status updated to "${status}"`,
          order: data,
          _action: { type: "navigate", path: "/dashboard/orders", label: "View Orders" },
        };
      },
    }),

    delete_product: tool({
      description: "Delete (archive) a product from the store. Sets its status to 'archived' instead of hard deleting. Use when the seller wants to remove a product.",
      parameters: z.object({
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
      parameters: z.object({
        limit: z.number().optional().describe("Number of conversations to fetch (default 5)"),
      }),
      execute: async ({ limit }) => {
        const limitNum = limit || 5;
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

    // ─── CUSTOMER TOOLS ───

    get_order_details: tool({
      description: "Get detailed information about a specific order, including items, customer info, and payment details. Use when the seller asks about a specific order.",
      parameters: z.object({
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
      description: "Get customer analytics and insights — total customers, returning customers, top spenders, and customer distribution. Use when the seller asks about their customers or wants customer analytics. Takes no parameters.",
      parameters: z.object({
        summary: z.boolean().optional().describe("Set to true for a brief summary, false for full details (default false)"),
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
  };
};
