const CACHE_NAME = "bebeu-pwa-v300";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css?v=300",
  "/app.js?v=300",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png"
];
const NETWORK_FIRST_PATHS = new Set(["/", "/index.html", "/styles.css", "/app.js"]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/photos/") ||
    url.pathname.startsWith("/chat-photos/") ||
    url.pathname.startsWith("/share/") ||
    url.pathname.startsWith("/s/")
  ) return;

  if (NETWORK_FIRST_PATHS.has(url.pathname)) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = payload.title || "BEBEU WORK";
  const options = {
    body: payload.body || "\uc0c8 \uba54\uc2dc\uc9c0\uac00 \uc788\uc2b5\ub2c8\ub2e4.",
    tag: payload.tag || "bebeu-chat-receipt",
    data: { url: payload.url || "/?open=chat-receipt" },
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [120, 80, 120],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/?open=chat-receipt", self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if ("focus" in client) {
        if ("navigate" in client) await client.navigate(targetUrl);
        await client.focus();
        client.postMessage({ type: "open-chat-receipt" });
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});












