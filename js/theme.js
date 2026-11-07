// إدارة المظهر: system (تلقائي) أو light أو dark
// يُحفَظ الاختيار على هذا الجهاز. وسيُزامَن مع الحساب في مرحلة المزامنة.
(function () {
  "use strict";

  const KEY = "study-app-theme";

  function get() {
    try {
      const value = window.localStorage.getItem(KEY);
      return value === "light" || value === "dark" ? value : "system";
    } catch (error) {
      return "system";
    }
  }

  function apply(value) {
    const root = document.documentElement;
    if (value === "light" || value === "dark") {
      root.setAttribute("data-theme", value);
    } else {
      root.removeAttribute("data-theme");
    }
  }

  function set(value) {
    try {
      if (value === "light" || value === "dark") {
        window.localStorage.setItem(KEY, value);
      } else {
        window.localStorage.removeItem(KEY);
      }
    } catch (error) {
      // لا يؤثر على عمل التطبيق
    }
    apply(value);
  }

  apply(get());
  window.Theme = { get, set };
})();
