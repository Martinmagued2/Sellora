import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────
// The auth helper uses three modules that need to be controlled:
//   1. @supabase/supabase-js   → createClient (service role + admin)
//   2. @supabase/ssr           → createServerClient (cookie session)
//   3. next/headers            → cookies()
//
// We make the supabase client a stable singleton so individual tests can
// override its `auth.getUser` / `from(...).single()` return values.

const mockFromChain = {
  select: vi.fn(() => mockFromChain),
  eq: vi.fn(() => mockFromChain),
  single: vi.fn(async () => ({ data: null, error: null })),
  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
};

const mockAuth = {
  getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
};

const mockClient = {
  auth: mockAuth,
  from: vi.fn(() => mockFromChain),
};

let _cookiesValue = { getAll: () => [], setAll: () => {} };

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockClient),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
  })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => _cookiesValue),
}));

// next/cache / next/navigation are server-only — stub them so api-wrappers
// can be imported without running afoul of "use server" restrictions.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// ─── Imports (after mocks) ────────────────────────────────
import { getAuthUser, getServiceRoleClient } from "@/lib/auth-helper";
import { withAuth, withAdmin, withPublic, withCron } from "@/lib/api-wrappers";
import { POST as tokenExchangePOST } from "@/app/api/auth/token-exchange/route";

// ─── Helpers ──────────────────────────────────────────────
function makeReq({ url = "https://test.test/api/x", headers = {} } = {}) {
  const h = new Map(Object.entries(headers));
  return {
    url,
    method: "GET",
    headers: {
      get: (name) => h.get(name.toLowerCase()) || null,
    },
  };
}

// ─── Setup / teardown ─────────────────────────────────────
beforeEach(() => {
  mockAuth.getUser.mockReset();
  mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mockFromChain.single.mockReset();
  mockFromChain.single.mockResolvedValue({ data: null, error: null });
  mockFromChain.maybeSingle.mockReset();
  mockFromChain.maybeSingle.mockResolvedValue({ data: null, error: null });
  _cookiesValue = { getAll: () => [], setAll: () => {} };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supa.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── getAuthUser ──────────────────────────────────────────
describe("getAuthUser", () => {
  it("returns null when no Authorization header and no cookies", async () => {
    const req = makeReq();
    const user = await getAuthUser(req);
    expect(user).toBeNull();
    expect(mockAuth.getUser).not.toHaveBeenCalled();
  });

  it("returns the user when a valid Bearer token is supplied", async () => {
    const fakeUser = { id: "u-1", email: "a@b.test" };
    mockAuth.getUser.mockResolvedValue({ data: { user: fakeUser }, error: null });

    const req = makeReq({ headers: { authorization: "Bearer abc.def.ghi" } });
    const user = await getAuthUser(req);
    expect(user).toEqual(fakeUser);
    expect(mockAuth.getUser).toHaveBeenCalledWith("abc.def.ghi");
  });

  it("strips only the first 'Bearer ' prefix and passes the rest as the token", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "x" } }, error: null });
    const req = makeReq({ headers: { authorization: "Bearer tok-with-spaces in it" } });
    await getAuthUser(req);
    expect(mockAuth.getUser).toHaveBeenCalledWith("tok-with-spaces in it");
  });

  it("falls through to cookie auth when supabase.auth.getUser returns an error", async () => {
    // Bearer path returns an error
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad jwt" } });

    // Set up a non-empty cookie store + a server client that returns a user
    _cookiesValue = { getAll: () => [{ name: "sb-token", value: "cookie-token" }], setAll: () => {} };
    const { createServerClient } = await import("@supabase/ssr");
    createServerClient.mockReturnValueOnce({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "cookie-user" } }, error: null })),
      },
    });

    const req = makeReq({ headers: { authorization: "Bearer badtoken" } });
    const user = await getAuthUser(req);
    expect(user).toEqual({ id: "cookie-user" });
  });

  it("returns null when getUser throws (bearer path) and cookie store is empty", async () => {
    mockAuth.getUser.mockRejectedValue(new Error("network"));
    const req = makeReq({ headers: { authorization: "Bearer xyz" } });
    const user = await getAuthUser(req);
    expect(user).toBeNull();
  });

  it("returns null when the cookie session returns an error", async () => {
    _cookiesValue = { getAll: () => [{ name: "sb", value: "x" }], setAll: () => {} };
    const { createServerClient } = await import("@supabase/ssr");
    createServerClient.mockReturnValueOnce({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: { message: "no session" } })),
      },
    });
    const req = makeReq();
    const user = await getAuthUser(req);
    expect(user).toBeNull();
  });

  it("returns null when the cookie session throws", async () => {
    _cookiesValue = { getAll: () => [{ name: "sb", value: "x" }], setAll: () => {} };
    const { createServerClient } = await import("@supabase/ssr");
    createServerClient.mockReturnValueOnce({
      auth: {
        getUser: vi.fn(async () => { throw new Error("boom"); }),
      },
    });
    const req = makeReq();
    const user = await getAuthUser(req);
    expect(user).toBeNull();
  });
});

// ─── getServiceRoleClient ─────────────────────────────────
describe("getServiceRoleClient", () => {
  it("returns a client object with auth.getUser and from()", () => {
    const client = getServiceRoleClient();
    expect(client).toBeDefined();
    expect(typeof client.auth.getUser).toBe("function");
    expect(typeof client.from).toBe("function");
  });
});

// ─── withAuth wrapper ─────────────────────────────────────
describe("withAuth wrapper", () => {
  it("returns 401 when getAuthUser resolves to null", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "no" } });

    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const req = makeReq();
    const res = await wrapped(req, {});
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes the handler with { user, admin, userId } when authed", async () => {
    const fakeUser = { id: "user-9", email: "z@y.test" };
    mockAuth.getUser.mockResolvedValue({ data: { user: fakeUser }, error: null });

    const handler = vi.fn(async () => new Response("ok", { status: 200 }));
    const wrapped = withAuth(handler);
    const req = makeReq({ headers: { authorization: "Bearer t" } });
    const res = await wrapped(req, {});
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const ctx = handler.mock.calls[0][1];
    expect(ctx.user).toEqual(fakeUser);
    expect(ctx.userId).toBe("user-9");
    expect(ctx.admin).toBeDefined();
  });

  it("returns 500 when the handler throws", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    const handler = vi.fn(async () => { throw new Error("boom"); });
    const wrapped = withAuth(handler);
    const req = makeReq({ headers: { authorization: "Bearer t" } });
    const res = await wrapped(req, {});
    expect(res.status).toBe(500);
  });

  it("with loadAccount returns 404 when the account is not found", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    mockFromChain.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const handler = vi.fn();
    const wrapped = withAuth(handler, { loadAccount: true });
    const req = makeReq({ headers: { authorization: "Bearer t" } });
    const res = await wrapped(req, {});
    expect(res.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });
});

// ─── withAdmin wrapper ────────────────────────────────────
describe("withAdmin wrapper", () => {
  it("returns 403 when account.role is not admin", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    mockFromChain.single.mockResolvedValue({
      data: { id: "u", role: "user", plan: "starter" },
      error: null,
    });

    const handler = vi.fn();
    const wrapped = withAdmin(handler);
    const req = makeReq({ headers: { authorization: "Bearer t" } });
    const res = await wrapped(req, {});
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes handler when account.role is admin", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    mockFromChain.single.mockResolvedValue({
      data: { id: "u", role: "admin", plan: "business" },
      error: null,
    });

    const handler = vi.fn(async () => new Response("ok", { status: 200 }));
    const wrapped = withAdmin(handler);
    const req = makeReq({ headers: { authorization: "Bearer t" } });
    const res = await wrapped(req, {});
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ─── withPublic wrapper ───────────────────────────────────
describe("withPublic wrapper", () => {
  it("calls handler with an admin client and does not require auth", async () => {
    const handler = vi.fn(async () => new Response("ok", { status: 200 }));
    const wrapped = withPublic(handler);
    const req = makeReq();
    const res = await wrapped(req, {});
    expect(res.status).toBe(200);
    const ctx = handler.mock.calls[0][1];
    expect(ctx.admin).toBeDefined();
  });

  it("returns 500 when handler throws", async () => {
    const handler = vi.fn(async () => { throw new Error("nope"); });
    const wrapped = withPublic(handler);
    const req = makeReq();
    const res = await wrapped(req, {});
    expect(res.status).toBe(500);
  });
});

// ─── withCron wrapper ─────────────────────────────────────
describe("withCron wrapper", () => {
  it("returns 401 when CRON_SECRET is set and Authorization header mismatches", async () => {
    process.env.CRON_SECRET = "secret-value";
    const handler = vi.fn();
    const wrapped = withCron(handler);
    const req = makeReq({ headers: { authorization: "Bearer wrong" } });
    const res = await wrapped(req, {});
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when CRON_SECRET matches Bearer header", async () => {
    process.env.CRON_SECRET = "secret-value";
    const handler = vi.fn(async () => new Response("ok", { status: 200 }));
    const wrapped = withCron(handler);
    const req = makeReq({ headers: { authorization: "Bearer secret-value" } });
    const res = await wrapped(req, {});
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ─── Token exchange route ─────────────────────────────────
describe("POST /api/auth/token-exchange", () => {
  function makeJsonReq(body, headers = {}) {
    return {
      url: "https://test.test/api/auth/token-exchange",
      method: "POST",
      headers: {
        get: (name) => headers[name.toLowerCase()] || null,
      },
      json: async () => body,
    };
  }

  it("returns 401 when no auth user", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "no" } });
    const res = await tokenExchangePOST(makeJsonReq({ shortLivedToken: "x" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when shortLivedToken is missing", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    const res = await tokenExchangePOST(makeJsonReq({}, { authorization: "Bearer t" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when Meta app credentials are not configured", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    delete process.env.NEXT_PUBLIC_META_APP_ID;
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    const res = await tokenExchangePOST(makeJsonReq({ shortLivedToken: "tok" }, { authorization: "Bearer t" }));
    expect(res.status).toBe(500);
  });

  it("returns 500 when Meta API does not return access_token", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    process.env.NEXT_PUBLIC_META_APP_ID = "appid";
    process.env.META_APP_SECRET = "appsecret";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: "bad token" }),
    });

    const res = await tokenExchangePOST(makeJsonReq({ shortLivedToken: "tok" }, { authorization: "Bearer t" }));
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });

  it("returns longLivedToken on successful exchange", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    process.env.NEXT_PUBLIC_META_APP_ID = "appid";
    process.env.META_APP_SECRET = "appsecret";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "long-token", expires_in: 5184000 }),
    });

    const res = await tokenExchangePOST(makeJsonReq({ shortLivedToken: "short" }, { authorization: "Bearer t" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.longLivedToken).toBe("long-token");
    expect(json.expiresIn).toBe(5184000);
    fetchMock.mockRestore();
  });

  it("returns 500 when fetch throws", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    process.env.NEXT_PUBLIC_META_APP_ID = "appid";
    process.env.META_APP_SECRET = "appsecret";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));
    const res = await tokenExchangePOST(makeJsonReq({ shortLivedToken: "short" }, { authorization: "Bearer t" }));
    expect(res.status).toBe(500);
    fetchMock.mockRestore();
  });
});
