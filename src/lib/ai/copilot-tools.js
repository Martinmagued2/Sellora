import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const createCopilotTools = (accountId) => {
  return {
    get_store_analytics: tool({
      description: "Get basic store analytics for a given time period (e.g. recent orders, revenue). Use this when the seller asks 'how are my sales?'",
      parameters: z.object({
        days: z.number().describe("Number of past days to analyze (e.g. 7, 30)"),
        start_date: z.string().optional().describe("ISO format start date (optional)"),
        startDate: z.string().optional().describe("Alternative start date parameter"),
        end_date: z.string().optional().describe("ISO format end date (optional)"),
        endDate: z.string().optional().describe("Alternative end date parameter"),
      }),
      execute: async ({ days, start_date, startDate, end_date, endDate }) => {
        const finalStartDate = start_date || startDate;
        const finalEndDate = end_date || endDate;
        let dateLimit;
        const daysNum = days || 30;

        if (finalStartDate) {
          dateLimit = new Date(finalStartDate);
        } else {
          dateLimit = new Date();
          dateLimit.setDate(dateLimit.getDate() - daysNum);
        }

        let dbQuery = supabase
          .from("orders")
          .select("id, total, status, created_at")
          .eq("account_id", accountId)
          .gte("created_at", dateLimit.toISOString());

        if (finalEndDate) {
          dbQuery = dbQuery.lte("created_at", new Date(finalEndDate).toISOString());
        }

        const { data, error } = await dbQuery;

        if (error || !data) return { success: false, error: "Failed to fetch analytics" };

        const totalRevenue = data.reduce((sum, order) => sum + (order.total || 0), 0);
        const orderCount = data.length;
        const pendingCount = data.filter((o) => o.status === "pending").length;

        return {
          success: true,
          days: finalStartDate ? undefined : daysNum,
          start_date: finalStartDate,
          end_date: finalEndDate,
          totalRevenue,
          orderCount,
          pendingCount,
        };
      },
    }),

    get_recent_conversations: tool({
      description: "Get a summary of recent active conversations and their status.",
      parameters: z.object({
        limit: z.number().describe("Number of conversations to fetch (e.g. 5)"),
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
        return { success: true, conversations: data };
      },
    }),

    get_top_products: tool({
      description: "Get the store's products to analyze inventory or top sellers.",
      parameters: z.object({
        limit: z.number().describe("Number of products to fetch (e.g. 5)"),
      }),
      execute: async ({ limit }) => {
        const limitNum = limit || 5;
        const { data, error } = await supabase
          .from("products")
          .select("id, name, price, stock, category")
          .eq("account_id", accountId)
          .eq("status", "active")
          .limit(limitNum);

        if (error) return { success: false, error: "Failed to fetch products" };
        return { success: true, products: data };
      },
    }),

    draft_product_description: tool({
      description: "Draft an SEO-optimized product description based on basic details provided by the seller.",
      parameters: z.object({
        name: z.string().optional().describe("The name of the product"),
        product_name: z.string().optional().describe("Alternative product name parameter"),
        features: z.string().describe("Key features or keywords to include"),
        tone: z.string().optional().describe("The tone of the description (e.g., professional, fun, luxurious)"),
      }),
      execute: async ({ name, product_name, features, tone }) => {
        const finalName = name || product_name || "Unnamed Product";
        const toneStr = tone || "professional";
        return {
          success: true,
          message: `I will write a ${toneStr} description for "${finalName}" highlighting: ${features}. (Please format the final output nicely using markdown).`,
        };
      },
    }),

    create_product: tool({
      description: "Create a new product in the store. Use this when the seller asks to add a new product.",
      parameters: z.object({
        name: z.string().describe("Product name"),
        description: z.string().optional().describe("Product description"),
        price: z.number().describe("Product price"),
        stock: z.number().optional().describe("Initial stock quantity"),
        category: z.string().optional().describe("Product category"),
      }),
      execute: async ({ name, description, price, stock, category }) => {
        if (!name) {
          return { success: false, error: "Product name is required" };
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
          .select("id, name, price, stock")
          .single();

        if (error) return { success: false, error: `Failed to create product: ${error.message}` };
        return {
          success: true,
          message: `Product "${name}" created successfully!`,
          product: data,
        };
      },
    }),
  };
};
