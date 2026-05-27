import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Logs a security event to the audit_logs table.
 */
export async function logSecurityEvent({ eventType, userId = null, ipAddress = null, route, details = {} }) {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      event_type: eventType,
      user_id: userId,
      ip_address: ipAddress,
      route: route,
      details: details,
    });
    
    if (error) console.error("Failed to save audit log:", error);
  } catch (err) {
    console.error("Error in logSecurityEvent:", err);
  }
}
