// التنقل بين صفحات التطبيق (بالرابط: #/today مثلاً)
(function () {
  "use strict";

  const ROUTES = [
    { id: "dashboard", title: "لوحة التحكم", en: "Dashboard" },
    { id: "today", title: "جلسات اليوم", en: "Today's Study" },
    { id: "plan", title: "الخطة الدراسية", en: "Study Plan" },
    { id: "subjects", title: "المواد الدراسية", en: "Subjects" },
    { id: "english", title: "اللغة الإنجليزية", en: "English" },
    { id: "review", title: "مركز المراجعة", en: "Review Center" },
    { id: "labs", title: "المختبرات العملية", en: "Practical Labs" },
    { id: "progress", title: "التقدم", en: "Progress" },
    { id: "reports", title: "التقارير", en: "Reports" },
    { id: "notes", title: "الملاحظات", en: "Notes" },
    { id: "settings", title: "الإعدادات", en: "Settings" },
  ];

  const APP_TITLE = "تطبيق التأسيس الأكاديمي";
  const registry = {};
  const ctx = { user: null };
  let cleanup = null;
  let wired = false;
  let visible = false;

  const $ = function (id) {
    return document.getElementById(id);
  };

  function routeFromHash() {
    const match = window.location.hash.match(/^#\/([a-z]+)$/);
    const id = match ? match[1] : "";
    return ROUTES.some(function (r) {
      return r.id === id;
    })
      ? id
      : "dashboard";
  }

  function buildNav() {
    const nav = $("nav");
    nav.textContent = "";
    ROUTES.forEach(function (route) {
      const link = document.createElement("a");
      link.href = "#/" + route.id;
      link.dataset.route = route.id;

      const icons = {
        dashboard: "⌂",
        today: "◷",
        plan: "▦",
        subjects: "◇",
        english: "Aa",
        review: "↻",
        labs: "⌘",
        progress: "◒",
        reports: "▤",
        notes: "✎",
        settings: "⚙",
      };
      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = icons[route.id] || "•";

      const copy = document.createElement("span");
      copy.className = "nav-copy";

      const label = document.createElement("span");
      label.textContent = route.title;
      const en = document.createElement("small");
      en.lang = "en";
      en.dir = "ltr";
      en.textContent = route.en;

      copy.appendChild(label);
      copy.appendChild(en);
      link.appendChild(icon);
      link.appendChild(copy);
      nav.appendChild(link);
    });
  }

  function setNavOpen(open) {
    document.body.classList.toggle("nav-open", open);
    $("menu-btn").setAttribute("aria-expanded", String(open));
    $("overlay").hidden = !open;
  }

  function runCleanup() {
    if (typeof cleanup === "function") {
      try {
        cleanup();
      } catch (error) {
        console.error("Page cleanup failed:", error);
      }
    }
    cleanup = null;
  }

  function renderRoute() {
    const id = routeFromHash();
    const route = ROUTES.find(function (r) {
      return r.id === id;
    });

    runCleanup();

    document.querySelectorAll("#nav a").forEach(function (link) {
      if (link.dataset.route === id) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    $("topbar-title").textContent = route.title;
    document.title = route.title + " | " + APP_TITLE;

    const body = $("page-body");
    body.textContent = "";
    const page = registry[id];
    if (page && typeof page.render === "function") {
      cleanup = page.render(body, ctx) || null;
    } else {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "هذه الصفحة غير متوفرة بعد.";
      body.appendChild(p);
    }

    body.classList.remove("route-enter");
    // إعادة تشغيل الحركة عند الانتقال، حتى عند تحديث الصفحة الحالية.
    void body.offsetWidth;
    body.classList.add("route-enter");

    setNavOpen(false);
    window.scrollTo(0, 0);
    $("page").focus({ preventScroll: true });
  }

  function wire() {
    buildNav();
    $("menu-btn").addEventListener("click", function () {
      setNavOpen(!document.body.classList.contains("nav-open"));
    });
    $("overlay").addEventListener("click", function () {
      setNavOpen(false);
    });
    $("nav").addEventListener("click", function (event) {
      const link = event.target.closest("a[data-route]");
      if (link && document.body.classList.contains("nav-open")) {
        // النقر على الصفحة الحالية لا يطلق hashchange، لذلك نغلق القائمة هنا أيضاً.
        setNavOpen(false);
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
        setNavOpen(false);
        $("menu-btn").focus();
      }
    });
    window.addEventListener("hashchange", function () {
      if (visible) {
        renderRoute();
      }
    });
  }

  // يُستدعى عند ظهور شاشة التطبيق. إن كان المستخدم نفسه ظاهراً فلا نعيد رسم الصفحة
  function show(user) {
    const sameUser = visible && ctx.user && user && ctx.user.id === user.id;
    ctx.user = user;
    if (sameUser) {
      return;
    }
    if (!wired) {
      wire();
      wired = true;
    }
    visible = true;
    renderRoute();
  }

  function hide() {
    if (!visible) {
      return;
    }
    visible = false;
    runCleanup();
    ctx.user = null;
    setNavOpen(false);
    document.title = APP_TITLE;
  }

  function register(id, page) {
    registry[id] = page;
  }

  window.Router = { ROUTES, register, show, hide };
})();
