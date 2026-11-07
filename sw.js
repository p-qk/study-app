// Service Worker - تطبيق التأسيس الأكاديمي
// عند تغيير أي ملف من ملفات التطبيق الأساسية، يُنصح برفع رقم الإصدار أدناه.
const CACHE_VERSION = "v15";
const CACHE_NAME = "study-app-" + CACHE_VERSION;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/base.css",
  "./js/vendor/supabase.js",
  "./js/config.js",
  "./js/auth.js",
  "./js/theme.js",
  "./js/router.js",
  "./js/pages/placeholders.js",
  "./js/study-plan.js",
  "./js/timer.js",
  "./js/pages/study.js",
  "./js/pages/review.js",
  "./js/pages/progress.js",
  "./js/pages/notes.js",
  "./js/pages/labs.js",
  "./js/backup.js",
  "./data/plan-index.json",
  "./data/month-01.json",
  "./js/pages/settings.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

// التثبيت: حفظ الملفات الأساسية للعمل بدون إنترنت
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// التفعيل: حذف النسخ القديمة من التخزين المؤقت
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("study-app-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// الطلبات: الشبكة أولاً (لتصلك آخر نسخة)، ثم التخزين المؤقت عند انقطاع الإنترنت
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // لا نتدخل إلا في طلبات GET من موقعنا نفسه (طلبات Supabase تمر دون تدخل)
  if (request.method !== "GET" || !url.href.startsWith(self.registration.scope)) {
    return;
  }

  let cacheWrite;
  const network = fetch(request, { cache: "no-cache" }).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      cacheWrite = caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  });
  event.waitUntil(network.then(() => cacheWrite).catch(() => {}));

  event.respondWith(
    network.catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const home = await cache.match("./index.html");
        if (home) return home;
      }
      return new Response("", { status: 503, statusText: "Offline" });
    })
  );
});
