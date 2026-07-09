/**
 * Shared TypeScript types for Sellora.
 *
 * Gradual TS migration — these types are available for any .ts/.tsx file
 * that wants them. Existing .js files continue to work unchanged.
 */

export type Plan = "starter" | "professional" | "business";
export type Channel = "whatsapp" | "instagram" | "facebook" | "manual";
export type ConversationStatus =
  | "new" | "open" | "in_progress"
  | "needs_attention" | "waiting_customer" | "closed" | "archived";
export type OrderStatus =
  | "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "returned";
export type PaymentStatus = "unpaid" | "paid" | "refunded";
export type ResolvedBy = "ai" | "human" | "mixed" | null;

export interface Account {
  id: string;
  email: string;
  owner_name?: string;
  business_name: string;
  business_description?: string;
  industry?: string;
  country: string;
  currency: string;
  phone?: string;
  logo_url?: string;
  plan: Plan;
  plan_status: "trialing" | "active" | "past_due" | "canceled";
  current_period_end?: string;
  whatsapp_connected: boolean;
  whatsapp_phone_number_id?: string;
  ai_enabled: boolean;
  ai_personality?: string;
  ai_languages?: string[];
  verified_status?: "unverified" | "pending" | "verified" | "rejected";
  verified_at?: string;
  onboarding_steps?: Record<string, boolean>;
  onboarding_completed_at?: string;
  first_sale_at?: string;
  first_sale_celebrated?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  account_id: string;
  name: string;
  phone?: string;
  email?: string;
  channel: Channel;
  tags: string[];
  notes?: string;
  total_orders: number;
  total_spent: number;
  lifetime_value: number;
  last_active_at: string;
  preferences?: Record<string, unknown>;
  ai_memory?: string;
  vip: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  account_id: string;
  customer_id: string;
  channel: Channel;
  status: ConversationStatus;
  assigned_to?: string;
  last_message_at: string;
  unread_count: number;
  ai_paused: boolean;
  ai_paused_until?: string;
  ai_paused_by?: string;
  snoozed_until?: string;
  summary?: string;
  summary_generated_at?: string;
  resolved_by: ResolvedBy;
  first_ai_reply_at?: string;
  first_human_reply_at?: string;
  last_ai_message_id?: string;
  escalation_reason?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  last_message?: Message;
  tags?: string[];
}

export interface Message {
  id: string;
  conversation_id: string;
  account_id: string;
  direction: "incoming" | "outgoing";
  content?: string;
  type: "text" | "image" | "video" | "document" | "audio" | "template" | "interactive" | "product_card";
  media_url?: string;
  is_ai: boolean;
  sentiment?: string;
  intent?: string;
  response_time_seconds?: number;
  delivery_status?: "delivered" | "failed" | "pending" | "read";
  delivered_at?: string;
  read_at?: string;
  whatsapp_message_id?: string;
  created_at: string;
}

export interface Product {
  id: string;
  account_id: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  category?: string;
  image_urls: string[];
  stock: number;
  status: "active" | "draft" | "archived";
  variants?: ProductVariant[];
  hidden_from_ai?: boolean;
  store_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id?: string;
  label?: string;
  name?: string;
  price?: number;
  stock?: number;
}

export interface Cart {
  id: string;
  account_id: string;
  conversation_id?: string;
  customer_id?: string;
  status: "open" | "converted" | "abandoned" | "expired";
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  coupon_code?: string;
  currency: string;
  converted_order_id?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  item_id: string;
  product_id: string;
  name: string;
  price: number;
  qty: number;
  variant?: string;
  added_at: string;
}

export interface Order {
  id: string;
  account_id: string;
  customer_id: string;
  order_number: string;
  items: CartItem[];
  subtotal: number;
  shipping_cost: number;
  total: number;
  currency: string;
  status: OrderStatus;
  channel: Channel;
  payment_method?: string;
  payment_status: PaymentStatus;
  payment_link?: string;
  shipping_address?: string;
  tracking_number?: string;
  carrier?: string;
  label_url?: string;
  shipped_at?: string;
  delivered_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  account_id: string;
  product_id: string;
  customer_id?: string;
  order_id?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  body?: string;
  status: "pending" | "published" | "rejected" | "flagged";
  source: "whatsapp" | "instagram" | "facebook" | "manual" | "web";
  reply?: string;
  reply_at?: string;
  created_at: string;
  product?: Pick<Product, "name">;
  customer?: Pick<Customer, "name">;
}

export interface Coupon {
  id: string;
  account_id: string;
  code: string;
  type: "percentage" | "fixed" | "free_shipping";
  subtype: "standard" | "bogo" | "tiered" | "first_order" | "customer_specific";
  value: number;
  min_order_value: number;
  max_uses?: number;
  used_count: number;
  starts_at: string;
  expires_at?: string;
  applies_to: "all" | "specific_products" | "specific_categories";
  product_ids?: string[];
  categories?: string[];
  is_active: boolean;
  bogo_buy_qty?: number;
  bogo_get_qty?: number;
  bogo_get_discount_percent?: number;
  tiered_rules?: Array<{ min: number; percent: number }>;
  target_customer_id?: string;
  auto_apply: boolean;
  created_at: string;
}

export interface TeamMember {
  id: string;
  account_id: string;
  email: string;
  name?: string;
  role: "owner" | "admin" | "agent";
  status: "active" | "invited" | "disabled";
  created_at: string;
}

export interface Notification {
  id: string;
  account_id: string;
  type:
    | "new_order" | "new_message" | "ai_escalation" | "payment_received"
    | "low_stock" | "campaign_sent" | "team_invite" | "install_bonus"
    | "low_review" | string;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
