/* Pen Game v5.0 service worker. Online multiplayer still requires the internet. */
const SHELL_CACHE = "pen-game-v5-shell-v1";
const RUNTIME_CACHE = "pen-game-v5-runtime-v1";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];
const CDN_SCRIPTS = [
  "https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js",
  "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
];
const scoped = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // One failed CDN request must not block installation of the local game shell.
    await Promise.all([
      ...CORE.map((path) => cache.add(scoped(path)).catch(() => null)),
      ...CDN_SCRIPTS.map((url) => cache.add(url).catch(() => null))
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, RUNTIME_CACHE]);
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith("pen-game-v5-") && !keep.has(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const key = scoped("./index.html");
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(SHELL_CACHE);
          await cache.put(key, response.clone()).catch(() => {});
        }
        return response;
      } catch (_) {
        return (await caches.match(request)) ||
          (await caches.match(key)) ||
          new Response("Pen Game is not available offline yet. Open it once while online.", {
            status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch (_) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // Cache only the pinned game scripts; all other third-party traffic stays untouched.
  if (request.destination === "script" &&
      (url.hostname === "cdnjs.cloudflare.com" || url.hostname === "cdn.jsdelivr.net")) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && (response.ok || response.type === "opaque")) {
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (_) {
        return Response.error();
      }
    })());
  }
});
