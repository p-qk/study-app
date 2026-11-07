// Service Worker - تطبيق التأسيس الأكاديمي
// عند تغيير أي ملف من ملفات التطبيق الأساسية، يُنصح برفع رقم الإصدار أدناه.
const CACHE_VERSION = "v10";
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
  "./data/plan-index.json",
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
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request, { cache: "no-cache" })
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) {
            return cached;
          }
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("", { status: 503, statusText: "Offline" });
        })
      )
  );
});
