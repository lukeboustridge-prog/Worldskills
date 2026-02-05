"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";

export function PushNotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSubscription();
  }, []);

  async function checkSubscription() {
    // Check if push notifications are supported
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    // Check if we have a VAPID key
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        setIsSubscribed(true);
      } else {
        // Only show prompt if permission isn't denied and user hasn't dismissed it
        const dismissed = localStorage.getItem("push-prompt-dismissed");
        if (Notification.permission !== "denied" && !dismissed) {
          setShowPrompt(true);
        }
      }
    } catch (err) {
      console.error("Error checking push subscription:", err);
    }
  }

  async function subscribe() {
    setIsLoading(true);
    setError(null);

    try {
      // Register service worker if not already registered
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Permission denied. Please enable notifications in your browser settings.");
        setIsLoading(false);
        return;
      }

      // Subscribe to push notifications
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setError("Push notifications are not configured.");
        setIsLoading(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send subscription to server
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        throw new Error("Failed to save subscription on server");
      }

      setIsSubscribed(true);
      setShowPrompt(false);
    } catch (err) {
      console.error("Failed to subscribe to push notifications:", err);
      setError("Failed to enable notifications. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push
        await subscription.unsubscribe();

        // Remove from server
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error("Failed to unsubscribe from push notifications:", err);
      setError("Failed to disable notifications. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function dismiss() {
    localStorage.setItem("push-prompt-dismissed", "true");
    setShowPrompt(false);
  }

  // Don't render anything on the server
  if (typeof window === "undefined") {
    return null;
  }

  // Show toggle button if already subscribed
  if (isSubscribed) {
    return (
      <button
        onClick={unsubscribe}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm text-green-700 hover:bg-green-100 disabled:opacity-50"
        title="Notifications enabled - click to disable"
      >
        <Bell className="h-4 w-4" />
        <span className="hidden sm:inline">Notifications on</span>
      </button>
    );
  }

  // Show prompt banner
  if (!showPrompt) {
    return null;
  }

  return (
    <div className="relative mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <Bell className="h-5 w-5 flex-shrink-0 text-blue-600" />
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900">Enable push notifications</p>
        <p className="text-xs text-blue-700">Get notified when someone posts a message to your skill conversations.</p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={subscribe}
          disabled={isLoading}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Enabling..." : "Enable"}
        </button>
        <button
          onClick={dismiss}
          className="rounded-md p-1.5 text-blue-600 hover:bg-blue-100"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Helper function to convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
