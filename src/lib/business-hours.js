/**
 * Business hours utility — extracted from the route handler for safe import.
 * Checks if the business is currently open based on business_hours + timezone.
 */

export function isBusinessOpen(businessHours, timezone = "Africa/Cairo") {
  if (!businessHours || Object.keys(businessHours).length === 0) return true;

  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() || days[now.getDay()];
    const timeStr = `${parts.find((p) => p.type === "hour")?.value || "00"}:${parts.find((p) => p.type === "minute")?.value || "00"}`;

    const todayHours = businessHours[weekday];
    if (!todayHours || !todayHours.enabled) return false;

    const currentMinutes = parseInt(timeStr.slice(0, 2)) * 60 + parseInt(timeStr.slice(3, 5));
    const startMinutes = parseInt((todayHours.start || "00:00").slice(0, 2)) * 60 + parseInt((todayHours.start || "00:00").slice(3, 5));
    const endMinutes = parseInt((todayHours.end || "23:59").slice(0, 2)) * 60 + parseInt((todayHours.end || "23:59").slice(3, 5));

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch (e) {
    console.warn("[BUSINESS-HOURS] check failed:", e.message);
    return true;
  }
}
