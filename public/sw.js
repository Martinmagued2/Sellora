// Sellora Service Worker - PWA Support
const CACHE_NAME = "sellora-v1";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/logo.png",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Silently fail for assets that don't exist yet
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith("http")) return;

  // Network-first for API calls
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(request);
        })
    );
    return;
  }

  // Cache-first for static assets (CSS, JS, images)
  if (
    url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML pages (with offline fallback)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Offline fallback page
          return new Response(
            `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Sellora - Offline</title></head>
<body style="background:#0a0a1a;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;">
<div>
<h1 style="font-size:2rem;margin-bottom:1rem;">You're Offline</h1>
<p style="color:#8E9297;">Sellora needs an internet connection. Please check your connection and try again.</p>
</div>
</body>
</html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        });
      })
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  let data = { title: "Sellora", body: "You have a new notification", icon: "/logo.png" };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/logo.png",
    badge: "/logo.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/dashboard",
    },
    actions: data.actions || [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes("dashboard") && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});

// Background sync for message sending when offline
self.addEventListener("sync", (event) => {
  if (event.tag === "send-message") {
    event.waitUntil(sendPendingMessages());
  }
});

async function sendPendingMessages() {
  // Retrieve pending messages from IndexedDB or localStorage
  try {
    const db = await openDB();
    const messages = await getAllPendingMessages(db);

    for (const msg of messages) {
      try {
        const response = await fetch("/api/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg),
        });

        if (response.ok) {
          await deletePendingMessage(db, msg.id);
        }
      } catch {
        // Will retry on next sync
        break;
      }
    }
  } catch {
    // IndexedDB not available
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("sellora-pending", 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("messages")) {
        db.createObjectStore("messages", { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function getAllPendingMessages(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deletePendingMessage(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
