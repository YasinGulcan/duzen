// Service worker: uygulama kabuğunu önbellekler ve telefon bildirimlerini gösterir.
const CACHE = "duzen-v4";
const SHELL = ["./", "index.html", "style.css", "js/app.js", "js/lib.js", "js/data.js", "js/views.js", "js/push.js", "js/push-config.js", "js/firebase-config.js", "manifest.json", "icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Firebase isteklerine dokunma
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});

/* ---------- bildirimler ---------- */
self.addEventListener("push", (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { data: { body: e.data?.text() } }; }
  const d = p.data || p.notification || {};
  e.waitUntil(self.registration.showNotification(d.title || "Düzen", {
    body: d.body || "",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    data: { url: d.url || "./" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.registration.scope));
    return open ? open.focus() : self.clients.openWindow(target);
  }));
});
