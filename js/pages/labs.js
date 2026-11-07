(function () {
  "use strict";

  function el(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  window.Router.register("labs", {
    render: function (container, ctx) {
      const key = "study-labs-v1-" + ctx.user.id;
      let active = true;
      const status = el("p", "جارٍ تحميل المختبرات…", "message info");
      status.setAttribute("role", "status");
      const list = el("div", "");
      const controls = [];
      container.append(el("h1", "المختبرات العملية", "page-title"), status, list);

      function read() {
        const saved = JSON.parse(localStorage.getItem(key) || "[]");
        if (!Array.isArray(saved)) throw new Error("Invalid lab progress");
        return new Set(saved);
      }

      function refresh() {
        try {
          const completed = read();
          const count = controls.filter(item => completed.has(item.id)).length;
          controls.forEach(item => { item.checkbox.checked = completed.has(item.id); });
          status.textContent = "المختبرات المكتملة: " + count + " من " + controls.length +
            " · يُحفظ الإنجاز على هذا الجهاز.";
        } catch (error) {
          status.textContent = "تعذّر قراءة إنجاز المختبرات المحفوظ على الجهاز.";
        }
      }

      async function load() {
        try {
          const months = await window.StudyPlan.load();
          if (!active) return;
          if (!months.length) {
            status.textContent = "تظهر المختبرات عند إضافة محتوى الشهر الأول.";
            return;
          }
          months.forEach(function (month, index) {
            const group = el("details", "", "panel");
            group.open = index === 0;
            group.appendChild(el("summary", month.title));
            month.days.forEach(function (day) {
              const dayGroup = el("details", "", "panel");
              dayGroup.appendChild(el("summary", "اليوم " + day.number));
              day.sessions.forEach(function (session) {
                if (session.trackingOnly) return;
                const lab = el("article", "", "panel");
                const description = el("p", session.practice);
                description.dir = "auto";
                description.style.whiteSpace = "pre-wrap";
                const checkbox = el("input", "");
                checkbox.type = "checkbox";
                const label = el("label", "");
                label.append(checkbox, " أنجزت هذا التطبيق");
                controls.push({ id: session.id, checkbox });
                checkbox.addEventListener("change", async function () {
                  const checked = checkbox.checked;
                  checkbox.disabled = true;
                  try {
                    if (!navigator.locks) throw new Error("Storage lock unavailable");
                    await navigator.locks.request(key, function () {
                      const completed = read();
                      if (checked) completed.add(session.id);
                      else completed.delete(session.id);
                      localStorage.setItem(key, JSON.stringify(Array.from(completed)));
                    });
                    if (active) refresh();
                  } catch (error) {
                    if (!active) return;
                    checkbox.checked = !checked;
                    status.textContent = "تعذّر حفظ إنجاز المختبر على هذا الجهاز.";
                  } finally {
                    checkbox.disabled = false;
                  }
                });
                lab.append(el("h3", session.title), el("p", session.subject, "muted"), description, label);
                dayGroup.appendChild(lab);
              });
              group.appendChild(dayGroup);
            });
            list.appendChild(group);
          });
          refresh();
        } catch (error) {
          if (!active) return;
          status.textContent = "تعذّر تحميل المختبرات. ";
          const retry = el("button", "إعادة المحاولة", "btn small");
          retry.type = "button";
          retry.addEventListener("click", function () {
            status.textContent = "جارٍ تحميل المختبرات…";
            load();
          }, { once: true });
          status.appendChild(retry);
        }
      }
      function onStorage(event) {
        if (event.key === key && controls.length) refresh();
      }
      window.addEventListener("storage", onStorage);
      load();
      return function () {
        active = false;
        window.removeEventListener("storage", onStorage);
      };
    },
  });
})();
