// صفحة الإعدادات: الحساب والمظهر وحالة النظام
(function () {
  "use strict";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function panel(title) {
    const section = el("section", "panel");
    section.appendChild(el("h2", "", title));
    return section;
  }

  function netText() {
    return "الاتصال: " + (navigator.onLine ? "متصل بالإنترنت" : "غير متصل (وضع العمل المحلي)");
  }

  window.Router.register("settings", {
    render: function (container, ctx) {
      // ---------- الحساب ----------
      const account = panel("الحساب");
      const emailLine = el("p", "");
      emailLine.appendChild(document.createTextNode("البريد الإلكتروني: "));
      const emailValue = el("span", "", ctx.user ? ctx.user.email : "");
      emailValue.dir = "ltr";
      emailLine.appendChild(emailValue);
      account.appendChild(emailLine);
      const logout = el("button", "btn small", "تسجيل الخروج");
      logout.type = "button";
      logout.dataset.action = "logout";
      account.appendChild(logout);
      container.appendChild(account);

      // ---------- المظهر ----------
      const appearance = panel("المظهر");
      const fieldset = el("fieldset");
      fieldset.appendChild(el("legend", "", "اختر المظهر (يُحفظ على هذا الجهاز)"));
      const options = [
        { value: "system", label: "تلقائي (حسب نظام التشغيل)" },
        { value: "light", label: "فاتح" },
        { value: "dark", label: "داكن" },
      ];
      const current = window.Theme.get();
      options.forEach(function (option) {
        const row = el("label", "radio-row");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "theme";
        input.value = option.value;
        input.checked = option.value === current;
        input.addEventListener("change", function () {
          window.Theme.set(option.value);
        });
        row.appendChild(input);
        row.appendChild(document.createTextNode(option.label));
        fieldset.appendChild(row);
      });
      appearance.appendChild(fieldset);
      container.appendChild(appearance);

      // ---------- حالة النظام ----------
      const status = panel("حالة النظام");
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
      status.appendChild(
        el("p", "muted", "وضع التشغيل: " + (standalone ? "نافذة تطبيق مستقلة" : "تبويب متصفح عادي"))
      );
      const net = el("p", "muted", netText());
      status.appendChild(net);
      const sw = el("p", "muted", "Service Worker: جارٍ الفحص...");
      status.appendChild(sw);
      container.appendChild(status);

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .getRegistration()
          .then(function (registration) {
            sw.textContent =
              "Service Worker: " + (registration && registration.active ? "مسجَّل ويعمل" : "غير مسجَّل");
          })
          .catch(function () {
            sw.textContent = "Service Worker: تعذر الفحص";
          });
      } else {
        sw.textContent = "Service Worker: غير مدعوم في هذا المتصفح";
      }

      const refreshNet = function () {
        net.textContent = netText();
      };
      window.addEventListener("online", refreshNet);
      window.addEventListener("offline", refreshNet);

      // ---------- النسخ الاحتياطي ----------
      const backup = panel("النسخ الاحتياطي");
      backup.appendChild(el("p", "muted", "تصدير بياناتك إلى ملف JSON واستيرادها: يُفعَّل في المرحلة 11."));
      container.appendChild(backup);

      return function cleanup() {
        window.removeEventListener("online", refreshNet);
        window.removeEventListener("offline", refreshNet);
      };
    },
  });
})();
