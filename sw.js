const CACHE = "mylife-cache-v5-2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./curriculum.json",
  "./sounds/ibadah.wav",
  "./sounds/kerja.wav",
  "./sounds/belajar.wav",
  "./sounds/tidur.wav",
  "./sounds/energi.wav",
  "./sounds/classic.wav"
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

function getVibrationPattern(soundId) {
  switch (soundId) {
    case "ibadah": return [300, 120, 300, 120, 500];
    case "kerja": return [200, 80, 200, 80, 200];
    case "belajar": return [180, 100, 350];
    case "tidur": return [500, 250, 500];
    case "energi": return [120, 60, 120, 60, 120, 60, 300];
    default: return [200, 100, 200];
  }
}

async function isAppOpenInForeground() {
  try {
    const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    return clientsArr.some((c) => c.visibilityState === "visible" || c.focused);
  } catch {
    return false;
  }
}

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
      const snd = item.sound || "default";
      const appVisible = await isAppOpenInForeground();
      const notifOpts = {
        body: item.body,
        icon: "./icons/icon.svg",
        badge: "./icons/icon.svg",
        tag: "mylife-" + item.id + "-" + snd,
        renotify: true,
        silent: appVisible,
        data: { url: item.targetTab ? `./#${item.targetTab}` : "./", sound: snd }
      };
      if (!appVisible) {
        notifOpts.vibrate = getVibrationPattern(snd);
      }
      await self.registration.showNotification(item.title, notifOpts);
    }
  }

  if (changed) {
    await setConfig(cfg);
  }
}

self.addEventListener("message", (e) => {
  const data = e.data || {};
  if (data.type === "SYNC_REMINDERS") {
    e.waitUntil(setConfig(data.payload).then(() => checkAndFireReminders()));
  } else if (data.type === "TEST_NOTIFICATION") {
    const snd = data.sound || "default";
    e.waitUntil(
      isAppOpenInForeground().then((appVisible) => {
        const isSilent = typeof data.silent === "boolean" ? data.silent : appVisible;
        const notifOpts = {
          body: data.body || "Notifikasi sistem berhasil dijalankan.",
          icon: "./icons/icon.svg",
          badge: "./icons/icon.svg",
          tag: "mylife-test-" + snd,
          renotify: true,
          silent: isSilent,
          data: { url: data.targetTab ? `./#${data.targetTab}` : "./", sound: snd }
        };
        if (!isSilent) {
          notifOpts.vibrate = getVibrationPattern(snd);
        }
        return self.registration.showNotification(data.title || "🔔 MyLife Pengingat Aktif", notifOpts);
      })
    );
  } else if (data.type === "CHECK_NOW") {
    e.waitUntil(checkAndFireReminders());
  }
});

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "mylife-reminder-sync") e.waitUntil(checkAndFireReminders());
});

self.addEventListener("sync", (e) => {
  if (e.tag === "mylife-reminder-sync") e.waitUntil(checkAndFireReminders());
});

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
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
