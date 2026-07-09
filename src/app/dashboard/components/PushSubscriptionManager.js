"use client";

import { useEffect } from "react";

/**
 * PushSubscriptionManager — registers the browser for web push notifications.
 *
 * Runs once on mount. If push is supported + configured + not yet subscribed,
 * it requests permission and subscribes. No UI — purely a side-effect component.
 *
 * Place this in the dashboard layout once (it's idempotent).
 */
export default function PushSubscriptionManager() {
  useEffect(() => {
    async function setupPush() {
      // Skip if service worker / push not supported
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

      try {
        // Check if push is configured on the server
        const keyRes = await fetch("/api/push/vapid-key");
        const keyData = await keyRes.json();
        if (!keyData.configured) return; // push not configured — skip silently

        // Wait for the service worker to be ready
        const reg = await navigator.serviceWorker.ready;

        // Check existing subscription
        let subscription = await reg.pushManager.getSubscription();
        if (subscription) {
          // Sync it to the server (in case it changed)
          await syncSubscription(subscription);
          return;
        }

        // Don't auto-prompt — wait for the user to enable notifications
        // via a button or the install prompt. This avoids the browser
        // blocking future permission requests.
      } catch (e) {
        // Silent fail — push is best-effort
      }
    }

    setupPush();
  }, []);

  return null;
}

async function syncSubscription(subscription) {
  try {
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.getKey("p256dh")
            ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh"))))
            : null,
          auth: subscription.getKey("auth")
            ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth"))))
            : null,
        },
      }),
    });
  } catch (e) {
    // Silent fail
  }
}

/**
 * Call this from a button click to request permission + subscribe.
 * Returns true if granted, false otherwise.
 */
export async function requestPushPermissionAndSubscribe() {
  if (typeof window === "undefined" || !("PushManager" in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  try {
    const keyRes = await fetch("/api/push/vapid-key");
    const keyData = await keyRes.json();
    if (!keyData.configured) return false;

    // Convert VAPID key to Uint8Array
    const publicKey = urlBase64ToUint8Array(keyData.publicKey);

    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey,
    });

    // Sync to server
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.getKey("p256dh")
            ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh"))))
            : null,
          auth: subscription.getKey("auth")
            ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth"))))
            : null,
        },
      }),
    });

    return true;
  } catch (e) {
    console.error("Push subscribe failed:", e);
    return false;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
