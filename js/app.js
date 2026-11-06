// عرض تاريخ اليوم
const dateElement = document.getElementById("today-date");
dateElement.textContent =
  "تاريخ اليوم: " +
  new Date().toLocaleDateString("ar-IQ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// عرض وضع التشغيل: نافذة تطبيق مستقلة أم تبويب متصفح
const modeElement = document.getElementById("mode-status");
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;
modeElement.textContent =
  "وضع التشغيل: " + (isStandalone ? "نافذة تطبيق مستقلة" : "تبويب متصفح عادي");

// عرض حالة الاتصال بالإنترنت
const netElement = document.getElementById("net-status");
function updateNetworkStatus() {
  netElement.textContent =
    "الاتصال: " + (navigator.onLine ? "متصل بالإنترنت" : "غير متصل (وضع العمل المحلي)");
}
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);
updateNetworkStatus();

// تسجيل Service Worker للعمل بدون إنترنت وإمكانية التثبيت
const swElement = document.getElementById("sw-status");
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then(() => {
      swElement.textContent = "Service Worker: مسجَّل";
    })
    .catch((error) => {
      swElement.textContent = "Service Worker: فشل التسجيل";
      console.error("Service Worker registration failed:", error);
    });
} else {
  swElement.textContent = "Service Worker: غير مدعوم في هذا المتصفح";
}