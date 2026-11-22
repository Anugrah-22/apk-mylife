const CACHE = "mylife-cache-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./curriculum.json"
];

const DB_NAME = "mylife_notif_db";
const STORE_NAME = "settings";

function openNotifDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getConfig() {
  try {
    const db = await openNotifDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get("schedule");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setConfig(val) {
  try {
    const db = await openNotifDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(val, "schedule");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.pathname.endsWith("/curriculum.json")) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(
      (c) =>
        c ||
        fetch(e.request)
          .then((r) => {
            const copy = r.clone();
            caches.open(CACHE).then((cache) => cache.put(e.request, copy));
            return r;
          })
          .catch(() => caches.match("./index.html"))
    )
  );
});

async function checkAndFireReminders() {
  const cfg = await getConfig();
  if (!cfg || !cfg.enabled || !Array.isArray(cfg.items)) return;

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const curHM = `${hh}:${mm}`;
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  cfg.fired = cfg.fired || {};
  let changed = false;

  for (const item of cfg.items) {
    if (!item.active) continue;
    const key = `${todayStr}_${item.id}`;
    if (item.time === curHM && !cfg.fired[key]) {
      cfg.fired[key] = true;
      changed = true;
      await self.registration.showNotification(item.title, {
        body: item.body,
        icon: "./icons/icon.svg",
        badge: "./icons/icon.svg",
        tag: "mylife-" + item.id,
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: item.targetTab ? `./#${item.targetTab}` : "./" }
      });
    }
  }

  if (changed) {
    await setConfig(cfg);
  }
}

self.addEventListener("message", (e) => {
  const data = e.data || {};
  if (data.type === "SYNC_REMINDERS") {
    e.waitUntil(
      setConfig(data.payload).then(() => checkAndFireReminders())
    );
  } else if (data.type === "TEST_NOTIFICATION") {
    e.waitUntil(
      self.registration.showNotification(data.title || "🔔 MyLife Pengingat Aktif", {
        body: data.body || "Notifikasi sistem Android berhasil diaktifkan! Pengingat jadwal akan muncul di bilah notifikasi HP.",
        icon: "./icons/icon.svg",
        badge: "./icons/icon.svg",
        tag: "mylife-test",
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: "./" }
      })
    );
  } else if (data.type === "CHECK_NOW") {
    e.waitUntil(checkAndFireReminders());
  }
});

// Periodic Background Sync (jalan di latar belakang pada Chrome/Android saat PWA terpasang)
self.addEventListener("periodicsync", (e) => {
  if (e.tag === "mylife-reminder-sync") {
    e.waitUntil(checkAndFireReminders());
  }
});

self.addEventListener("sync", (e) => {
  if (e.tag === "mylife-reminder-sync") {
    e.waitUntil(checkAndFireReminders());
  }
});

// Web Push handler (jika suatu saat dihubungkan ke Firebase Cloud Messaging / server push)
self.addEventListener("push", (e) => {
  let payload = { title: "MyLife", body: "Waktunya menjalankan agenda harianmu!" };
  try {
    if (e.data) payload = { ...payload, ...e.data.json() };
  } catch {
    if (e.data) payload.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "./icons/icon.svg",
      badge: "./icons/icon.svg",
      vibrate: [200, 100, 200],
      data: { url: "./" }
    })
  );
});

// Buka langsung aplikasi MyLife saat notifikasi di bilah status HP diketuk
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ("focus" in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
