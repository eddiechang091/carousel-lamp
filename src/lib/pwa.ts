// PWA service worker registration.
//
// The worker itself (bundle/sw.js) is generated at build time by
// scripts/pwa-sw-plugin.ts. Registration is safe to call anywhere:
// it no-ops outside production builds and where service workers are
// unavailable, and it never throws — a failed registration just means
// the app runs without offline support, like before.

export async function registerServiceWorker(options: {
  enabled?: boolean;
} = {}): Promise<ServiceWorkerRegistration | null> {
  const enabled = options.enabled ?? import.meta.env.PROD;
  if (!enabled) return null;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}
