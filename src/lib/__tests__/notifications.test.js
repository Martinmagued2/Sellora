import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────
// notifications.js calls createClient() to build a service-role client,
// then runs `.from("accounts").select(...)`, `.from("notifications").insert(...)`,
// `.from("push_subscriptions").select(...)`. We mock the client so
// individual tests can control each chain.

const mockFromChain = {
  select: vi.fn(() => mockFromChain),
  eq: vi.fn(() => mockFromChain),
  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  single: vi.fn(async () => ({ data: null, error: null })),
  insert: vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: null, error: null })),
    })),
  })),
  update: vi.fn(() => mockFromChain),
  limit: vi.fn(() => mockFromChain),
};

const mockAuth = { getUser: vi.fn() };
const mockClient = {
  auth: mockAuth,
  from: vi.fn(() => mockFromChain),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockClient),
}));

// Mock @/lib/email — notify() imports it dynamically.
const mockIsEmailConfigured = vi.fn(() => false);
const mockSendCustomEmail = vi.fn(async () => ({}));
vi.mock("@/lib/email", () => ({
  isEmailConfigured: (...args) => mockIsEmailConfigured(...args),
  sendCustomEmail: (...args) => mockSendCustomEmail(...args),
  sendWelcomeEmail: vi.fn(async () => ({})),
  sendOrderConfirmationEmail: vi.fn(async () => ({})),
}));

// ─── Imports (after mocks) ────────────────────────────────
import { notify, getNotifPrefs, updateNotifPrefs } from "@/lib/notifications";

// ─── Setup / teardown ─────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  // Default: account fetch returns null (no prefs, no email)
  mockFromChain.maybeSingle.mockResolvedValue({ data: null, error: null });
  // Default: notification insert returns null
  mockFromChain.insert.mockReturnValue({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: "notif-1" }, error: null })),
    })),
  });
  // Default: account update returns no error
  mockFromChain.update.mockReturnValue({
    eq: vi.fn(async () => ({ error: null })),
  });

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supa.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper: build an account row to return from .from("accounts").maybeSingle()
function setAccountResponse(account) {
  mockFromChain.maybeSingle.mockResolvedValueOnce({ data: account, error: null });
}

// ─── notify() validation ──────────────────────────────────
describe("notify() input validation", () => {
  it("rejects when accountId is missing", async () => {
    const r = await notify(null, { category: "orders", type: "x", title: "t" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Missing required fields/);
  });

  it("rejects when category is missing", async () => {
    const r = await notify("acc-1", { type: "x", title: "t" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Missing required fields/);
  });

  it("rejects when type is missing", async () => {
    const r = await notify("acc-1", { category: "orders", title: "t" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Missing required fields/);
  });

  it("rejects when title is missing", async () => {
    const r = await notify("acc-1", { category: "orders", type: "x" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Missing required fields/);
  });

  it("rejects an invalid category", async () => {
    const r = await notify("acc-1", { category: "not_a_real_category", type: "x", title: "t" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Invalid category/);
  });

  it("rejects an invalid priority", async () => {
    const r = await notify("acc-1", {
      category: "orders", type: "x", title: "t", priority: "supercritical",
    });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Invalid priority/);
  });
});

// ─── notify() category allowlist ──────────────────────────
describe("notify() VALID_CATEGORIES", () => {
  const VALID = [
    "orders", "messages", "payments", "products", "customers",
    "reviews", "team", "channels", "ai", "automation", "security", "system",
  ];

  it.each(VALID)("accepts category '%s' and returns success", async (category) => {
    setAccountResponse({ notif_prefs: null, email: "x@y.test" });
    const r = await notify("acc-1", { category, type: "test", title: "t" });
    expect(r.success).toBe(true);
  });
});

// ─── notify() happy path ──────────────────────────────────
describe("notify() dashboard delivery", () => {
  it("creates a row in notifications table and returns it", async () => {
    setAccountResponse({ notif_prefs: null, email: "x@y.test" });
    const r = await notify("acc-1", {
      category: "orders", type: "new_order", title: "New!", message: "Order #1",
    });
    expect(r.success).toBe(true);
    expect(r.notification).toEqual({ id: "notif-1" });
    expect(mockClient.from).toHaveBeenCalledWith("notifications");
    expect(mockFromChain.insert).toHaveBeenCalled();
  });

  it("respects prefs.dashboard: false (skips the insert)", async () => {
    setAccountResponse({
      notif_prefs: { orders: { dashboard: false } },
      email: "x@y.test",
    });
    const r = await notify("acc-1", {
      category: "orders", type: "new_order", title: "t",
    });
    expect(r.success).toBe(true);
    expect(r.notification).toBeNull();
    // insert should NOT have been called (no dashboard row created)
    expect(mockFromChain.insert).not.toHaveBeenCalled();
  });

  it("truncates title to 200 chars and message to 1000 chars", async () => {
    setAccountResponse({ notif_prefs: null, email: "x@y.test" });
    const longTitle = "A".repeat(500);
    const longMessage = "B".repeat(2000);
    await notify("acc-1", {
      category: "orders", type: "x", title: longTitle, message: longMessage,
    });
    const insertArg = mockFromChain.insert.mock.calls[0][0];
    expect(insertArg.title.length).toBe(200);
    expect(insertArg.message.length).toBe(1000);
  });
});

// ─── notify() push delivery ───────────────────────────────
describe("notify() push delivery", () => {
  it("sends a push notification when prefs.push is true", async () => {
    setAccountResponse({
      notif_prefs: { orders: { dashboard: true, push: true } },
      email: "x@y.test",
    });
    // mock push_subscriptions select to return one active sub
    const subsResult = { data: [{ endpoint: "https://push.test/abc", keys: {} }], error: null };
    // Override from() to return a chain whose .select() eventually yields subs
    mockClient.from.mockImplementation((table) => {
      if (table === "push_subscriptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(async () => subsResult),
              })),
            })),
          })),
        };
      }
      return mockFromChain;
    });
    // Mock fetch for the push send endpoint
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true });

    await notify("acc-1", {
      category: "orders", type: "new_order", title: "Push!", message: "hello",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callUrl = fetchMock.mock.calls[0][0];
    expect(callUrl).toContain("/api/push/send");
    fetchMock.mockRestore();
  });

  it("does NOT send push when prefs.push is false", async () => {
    setAccountResponse({
      notif_prefs: { orders: { push: false } },
      email: "x@y.test",
    });
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await notify("acc-1", {
      category: "orders", type: "new_order", title: "t",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});

// ─── notify() email delivery ──────────────────────────────
describe("notify() email delivery", () => {
  it("sends an email when prefs.email is true and account email is set", async () => {
    setAccountResponse({
      notif_prefs: { orders: { email: true } },
      email: "owner@store.test",
    });
    mockIsEmailConfigured.mockReturnValue(true);

    await notify("acc-1", {
      category: "orders", type: "new_order", title: "Email!", message: "hi",
    });

    expect(mockSendCustomEmail).toHaveBeenCalledTimes(1);
    const arg = mockSendCustomEmail.mock.calls[0][0];
    expect(arg.to).toBe("owner@store.test");
    expect(arg.subject).toContain("Email!");
  });

  it("does NOT send email when account email is missing", async () => {
    setAccountResponse({
      notif_prefs: { orders: { email: true } },
      email: null,
    });
    mockIsEmailConfigured.mockReturnValue(true);

    await notify("acc-1", {
      category: "orders", type: "new_order", title: "t",
    });
    expect(mockSendCustomEmail).not.toHaveBeenCalled();
  });

  it("does NOT send email when email is not configured at the app level", async () => {
    setAccountResponse({
      notif_prefs: { orders: { email: true } },
      email: "owner@store.test",
    });
    mockIsEmailConfigured.mockReturnValue(false);

    await notify("acc-1", {
      category: "orders", type: "new_order", title: "t",
    });
    expect(mockSendCustomEmail).not.toHaveBeenCalled();
  });
});

// ─── notify() resilience ──────────────────────────────────
describe("notify() resilience", () => {
  it("returns success even when prefs fetch throws", async () => {
    mockFromChain.maybeSingle.mockRejectedValueOnce(new Error("db down"));
    const r = await notify("acc-1", { category: "orders", type: "x", title: "t" });
    expect(r.success).toBe(true);
  });

  it("returns success with notification:null when insert throws", async () => {
    setAccountResponse({ notif_prefs: null, email: "x@y.test" });
    mockFromChain.insert.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn(async () => { throw new Error("insert failed"); }),
      })),
    });
    const r = await notify("acc-1", { category: "orders", type: "x", title: "t" });
    expect(r.success).toBe(true);
    expect(r.notification).toBeNull();
  });
});

// ─── getNotifPrefs ────────────────────────────────────────
describe("getNotifPrefs", () => {
  it("returns the notif_prefs object when present", async () => {
    mockFromChain.maybeSingle.mockResolvedValueOnce({
      data: { notif_prefs: { orders: { push: true } } },
      error: null,
    });
    const prefs = await getNotifPrefs("acc-1");
    expect(prefs).toEqual({ orders: { push: true } });
  });

  it("returns null when account is not found", async () => {
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const prefs = await getNotifPrefs("acc-1");
    expect(prefs).toBeNull();
  });
});

// ─── updateNotifPrefs ─────────────────────────────────────
describe("updateNotifPrefs", () => {
  it("sanitizes prefs: only known categories are kept, with bool coercion", async () => {
    mockFromChain.update.mockReturnValueOnce({
      eq: vi.fn(async () => ({ error: null })),
    });

    const input = {
      orders: { dashboard: "yes", push: 1, email: 0 }, // truthy/falsy values
      fake_category: { dashboard: true },                // should be dropped
      messages: { dashboard: true, push: false, email: true },
    };
    const r = await updateNotifPrefs("acc-1", input);
    expect(r.success).toBe(true);
    expect(r.prefs.orders).toEqual({ dashboard: true, push: true, email: false });
    expect(r.prefs.messages).toEqual({ dashboard: true, push: false, email: true });
    expect(r.prefs).not.toHaveProperty("fake_category");
  });

  it("returns failure when the database update errors", async () => {
    mockFromChain.update.mockReturnValueOnce({
      eq: vi.fn(async () => ({ error: { message: "no perms" } })),
    });
    const r = await updateNotifPrefs("acc-1", { orders: { dashboard: true } });
    expect(r.success).toBe(false);
    expect(r.error).toBe("no perms");
  });

  it("produces an empty sanitized object when input has no known categories", async () => {
    mockFromChain.update.mockReturnValueOnce({
      eq: vi.fn(async () => ({ error: null })),
    });
    const r = await updateNotifPrefs("acc-1", { bogus: { dashboard: true } });
    expect(r.success).toBe(true);
    expect(r.prefs).toEqual({});
  });
});
