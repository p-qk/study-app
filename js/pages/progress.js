(function () {
  "use strict";

  function el(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function panel(container, title) {
    const section = el("section", "", "panel");
    section.appendChild(el("h2", title));
    container.appendChild(section);
    return section;
  }

  function summarize(container, days, dates) {
    const sessions = days.flatMap(day => day.sessions);
    const completed = sessions.filter(session => dates.has(session.id)).length;
    const finishedDays = days.filter(day => day.sessions.every(session => dates.has(session.id))).length;
    const summary = panel(container, "إنجاز الخطة المتاحة");
    const ratio = Math.round(completed * 100 / sessions.length);
    summary.append(el("p", completed + " من " + sessions.length + " جلسة مكتملة · " + ratio + "٪"),
      el("p", finishedDays + " من " + days.length + " يوم مكتمل"));
    const meter = el("progress", "");
    meter.max = sessions.length;
    meter.value = completed;
    meter.setAttribute("aria-label", "نسبة إنجاز الخطة المتاحة");
    summary.appendChild(meter);
  }

  function subjects(container, sessions, dates) {
    const counts = new Map();
    sessions.forEach(function (session) {
      const count = counts.get(session.subject) || { total: 0, done: 0 };
      count.total++;
      if (dates.has(session.id)) count.done++;
      counts.set(session.subject, count);
    });
    const list = el("ul", "");
    counts.forEach(function (count, subject) {
      list.appendChild(el("li", subject + " · " + count.done + " من " + count.total +
        " · " + Math.round(count.done * 100 / count.total) + "٪"));
    });
    panel(container, "التقدّم حسب المادة").appendChild(list);
  }

  function dateKey(date) {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function reports(container, sessions, dates) {
    const now = new Date();
    const today = dateKey(now);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const week = dateKey(startOfWeek);
    const history = new Map();
    sessions.forEach(function (session) {
      if (!dates.has(session.id)) return;
      const date = new Date(dates.get(session.id));
      if (!Number.isFinite(date.getTime())) return;
      const key = dateKey(date);
      const titles = history.get(key) || [];
      titles.push(session.title);
      history.set(key, titles);
    });
    const totals = [0, 0, 0];
    history.forEach(function (titles, key) {
      if (key === today) totals[0] += titles.length;
      if (key >= week && key <= today) totals[1] += titles.length;
      if (key.slice(0, 7) === today.slice(0, 7) && key <= today) totals[2] += titles.length;
    });
    const periods = panel(container, "الجلسات المكتملة حسب الفترة");
    ["اليوم", "آخر 7 أيام", "هذا الشهر"].forEach(function (label, index) {
      periods.appendChild(el("p", label + " · " + totals[index]));
    });
    const log = panel(container, "سجل الإنجاز");
    if (!history.size) {
      log.appendChild(el("p", "يظهر هنا سجل الجلسات المكتملة.", "muted"));
      return;
    }
    const format = new Intl.DateTimeFormat("ar-IQ", { dateStyle: "long", timeZone: "UTC" });
    Array.from(history.keys()).sort().reverse().forEach(function (key) {
      const details = el("details", "");
      const titles = history.get(key);
      details.appendChild(el("summary", format.format(new Date(key)) + " · " + titles.length + " جلسة"));
      const list = el("ul", "");
      titles.forEach(title => list.appendChild(el("li", title)));
      details.appendChild(list);
      log.appendChild(details);
    });
  }

  function register(route, title) {
    window.Router.register(route, {
      render: function (container, ctx) {
        const userId = ctx.user.id;
        let active = true;
        const status = el("p", "جارٍ تحميل التقدّم…", "message info");
        status.setAttribute("role", "status");
        container.append(el("h1", title, "page-title"), status);
        async function load() {
          status.textContent = "جارٍ تحميل التقدّم…";
          try {
            const months = await window.StudyPlan.load();
            if (!active) return;
            const days = months.flatMap(month => month.days);
            const sessions = days.flatMap(day => day.sessions);
            if (!sessions.length) {
              status.textContent = "تظهر إحصاءات الدراسة عند إضافة محتوى الشهر الأول.";
              return;
            }
            const local = window.StudyTimer.open(userId, sessions).read().records;
            const dates = new Map();
            Object.entries(local).forEach(function ([id, record]) {
              if (record.completedAt) dates.set(id, record.completedAt);
            });
            try {
              const remote = await window.Auth.syncCompletions(userId, []);
              remote.forEach(row => dates.set(row.session_key, row.completed_at));
              status.hidden = true;
            } catch (error) {
              status.textContent = "تُعرض البيانات المحفوظة على هذا الجهاز حاليًا.";
            }
            if (!active) return;
            if (route === "reports") reports(container, sessions, dates);
            else summarize(container, days, dates);
            if (route === "progress") subjects(container, sessions, dates);
            if (route === "dashboard") {
              const next = sessions.find(session => !dates.has(session.id));
              const section = panel(container, "الجلسة التالية");
              section.appendChild(el("p", next ? next.title : "أكملت جميع الجلسات المتاحة."));
              if (next) {
                const link = el("a", "افتح جلسات اليوم");
                link.href = "#/today";
                section.appendChild(link);
              }
            }
          } catch (error) {
            if (!active) return;
            status.hidden = false;
            status.textContent = "تعذّر تحميل التقدّم. ";
            const retry = el("button", "إعادة المحاولة", "btn small");
            retry.type = "button";
            retry.addEventListener("click", load, { once: true });
            status.appendChild(retry);
          }
        }
        load();
        return function () { active = false; };
      },
    });
  }

  register("dashboard", "لوحة التحكم");
  register("progress", "التقدّم");
  register("reports", "التقارير");
})();
