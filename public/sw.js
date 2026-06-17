// Sellora Service Worker — offline-capable PWA
// Strategy:
//   - App shell (HTML, CSS, JS): stale-while-revalidate (instant load + background update)
//   - API GET requests: network-first, fall back to cache (5min stale ok)
//   - Images: cache-first (don't re-download)
//   - API mutations (POST/PUT/DELETE): network-only (never cache)

const CACHE_VERSION = "sellora-v3";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

const APP_SHELL_ASSETS = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/logo.png",
];

// ─── Install: pre-cache app shell ───
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS).catch(() => {
        // Silently fail for any asset that doesn't exist
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate: clean up old caches ───
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.startsWith(CACHE_VERSION))
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ─── Push notifications ───
self.addEventListener("push", (event) => {
  let payload = { title: "Sellora", body: "New notification", url: "/dashboard" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/logo.png",
      badge: "/logo.png",
      tag: payload.tag || "sellora-notification",
      data: { url: payload.url || "/dashboard" },
    })
  );
});

// ─── Notification click — focus the app ───
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ─── Fetch: route by request type ───
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations are network-only)
  if (request.method !== "GET") return;

  // Skip cross-origin requests (fonts, analytics, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip Next.js HMR + internal
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  // API GET requests — network-first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE, 5 * 60 * 1000));
    return;
  }

  // Images — cache-first
  if (request.destination === "image" || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Everything else (app shell, pages, JS, CSS) — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, APP_SHELL_CACHE));
});

// ─── Cache strategies ───

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request, cacheName, maxAge = 5 * 60 * 1000) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    // Network failed — try cache
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "You are offline" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached); // network failed, fall through to cached

  return cached || fetchPromise;
}

// ─── Message handler — allow the app to trigger updates ───
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
