(function () {
  "use strict";

  const dateFormat = new Intl.DateTimeFormat("ar-IQ", {
    dateStyle: "long",
    timeZone: "UTC",
  });

  function el(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text || "";
    if (className) node.className = className;
    return node;
  }

  function sessionCard(session, index) {
    const details = el("details", "", "panel");
    details.appendChild(el("summary", (index + 1) + ". " + session.title));
    details.appendChild(el("p", session.subject + " · " + session.minutes + " دقيقة", "muted"));
    [
      ["الأهداف", session.objectives],
      ["المفاهيم", session.concepts],
      ["كلمات البحث", session.keywords],
      ["التطبيق العملي", [session.practice]],
      ["المراجعة", [session.review]],
      ["الإنجليزية التقنية", session.english],
      ["المراجع", session.resources],
    ].forEach(function ([label, values]) {
      if (!values.length) return;
      details.appendChild(el("h3", label));
      const list = el("ul");
      values.forEach(function (value) {
        const item = el("li", value);
        item.dir = "auto";
        list.appendChild(item);
      });
      details.appendChild(list);
    });
    return details;
  }

  function showPlan(container, months) {
    const publishedDays = months.reduce(function (count, month) { return count + month.days.length; }, 0);
    container.appendChild(el("p", "الأيام المتاحة: " + publishedDays + " من " + window.StudyPlan.totalDays, "muted"));
    months.forEach(function (month) {
      const details = el("details", "", "panel");
      details.appendChild(el("summary", month.title + " · " + month.days.length + " يوم"));
      month.days.forEach(function (day) {
        const dayDetails = el("details", "", "panel");
        dayDetails.appendChild(el("summary", "اليوم " + day.number + " · " + dateFormat.format(day.date)));
        day.sessions.forEach(function (session, index) {
          dayDetails.appendChild(sessionCard(session, index));
        });
        details.appendChild(dayDetails);
      });
      container.appendChild(details);
    });
  }

  function showToday(container, months, userId) {
    const days = months.flatMap(function (month) { return month.days; });
    const sessions = days.flatMap(function (day) { return day.sessions; });
    const timer = window.StudyTimer.open(userId, sessions);
    const content = el("div");
    const message = el("p", "", "message");
    message.setAttribute("role", "status");
    message.hidden = true;
    container.append(content, message);
    let active = true;
    let signature = "";
    let clock = null;
    let completeButton = null;
    const syncStatus = el("p", "", "muted");
    syncStatus.setAttribute("role", "status");
    container.insertBefore(syncStatus, content);
    let syncing = false;
    let syncAgain = false;
    async function sync() {
      if (!active) return;
      if (syncing) {
        syncAgain = true;
        return;
      }
      if (!navigator.onLine) {
        syncStatus.textContent = "لا يوجد اتصال. التقدّم محفوظ على هذا الجهاز.";
        return;
      }
      syncing = true;
      try {
        const result = await timer.sync();
        if (active) {
          syncStatus.textContent = {
            ok: "تمت مزامنة التقدّم والمؤقت.",
            conflict: "تغيّر المؤقت على جهاز آخر. عُرضت حالته المحفوظة على الحساب.",
            retry: "تغيّر المؤقت أثناء المزامنة. ستتم إعادة المحاولة.",
            "other-plan": "المؤقت على الحساب مرتبط بخطة أخرى.",
          }[result];
          refresh();
        }
      } catch (error) {
        if (active) syncStatus.textContent = "تعذّرت المزامنة. سيعيد التطبيق المحاولة تلقائيًا.";
      } finally {
        syncing = false;
        if (syncAgain) {
          syncAgain = false;
          sync();
        }
      }
    }
    function refresh() {
      if (!active) return;
      try {
        const state = timer.read();
        const current = timer.current(state);
        const record = current && state.records[current.id];
        const nextSignature = JSON.stringify(state);
        if (!content.childNodes.length || signature !== nextSignature) {
          signature = nextSignature;
          content.textContent = "";
          clock = null;
          completeButton = null;
          if (!current) {
            content.appendChild(el("p", "أكملت جميع الجلسات المتاحة. ستظهر الجلسات الجديدة عند إضافة الشهر التالي.", "message success"));
            return;
          }
          const day = days.find(function (item) {
            return item.sessions.some(function (session) { return session.id === current.id; });
          });
          content.appendChild(el("h2", "اليوم " + day.number));
          content.appendChild(el("p", "تاريخ الخطة: " + dateFormat.format(day.date), "muted"));
          day.sessions.forEach(function (session, index) {
            const card = sessionCard(session, index);
            const done = state.records[session.id]?.completedAt;
            if (session.id === current.id) {
              card.open = true;
              clock = el("p", "", "study-clock");
              clock.setAttribute("role", "timer");
              card.appendChild(clock);
              const actions = el("div", "", "timer-actions");
              [
                [record?.startedAt != null ? "pause" : "start", record?.startedAt != null ? "إيقاف مؤقت" : "بدء / استئناف"],
                ["reset", "إعادة ضبط"],
                ["complete", "إكمال الجلسة"],
              ].forEach(function ([action, label]) {
                const button = el("button", label, "btn small");
                button.type = "button";
                if (action === "complete") completeButton = button;
                button.addEventListener("click", async function () {
                  if (action === "reset" && !window.confirm("إعادة وقت هذه الجلسة إلى الصفر؟")) return;
                  button.disabled = true;
                  try {
                    await timer.act(session.id, action);
                    if (!active) return;
                    message.hidden = true;
                    refresh();
                    sync();
                  } catch (error) {
                    if (!active) return;
                    message.textContent = "تعذّر حفظ التغيير. " + error.message;
                    message.hidden = false;
                    button.disabled = false;
                  }
                });
                actions.appendChild(button);
              });
              card.appendChild(actions);
            } else {
              card.appendChild(el("p", done ? "مكتملة" : "تُفتح بعد إكمال الجلسة السابقة", "muted"));
            }
            content.appendChild(card);
          });
        }
        if (current && clock) {
          const seconds = Math.floor(timer.elapsed(record, Date.now()));
          clock.textContent = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
          completeButton.disabled = seconds < current.minutes * 60;
        }
      } catch (error) {
        content.textContent = "";
        signature = "";
        message.textContent = "تعذّر قراءة التقدم المحفوظ على الجهاز. " + error.message;
        message.hidden = false;
      }
    }
    refresh();
    sync();
    const interval = window.setInterval(refresh, 1000);
    const syncInterval = window.setInterval(sync, 30000);
    window.addEventListener("storage", refresh);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("focus", sync);
    return function () {
      active = false;
      window.clearInterval(interval);
      window.clearInterval(syncInterval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("focus", sync);
    };
  }

  function showCatalog(container, months, field) {
    const values = new Set();
    months.forEach(function (month) {
      month.days.forEach(function (day) {
        day.sessions.forEach(function (session) {
          if (field === "subject") values.add(session.subject);
          else session.english.forEach(function (term) { values.add(term); });
        });
      });
    });
    if (!values.size) {
      container.appendChild(el("p", "لا توجد مصطلحات إنجليزية في المحتوى المتاح.", "muted"));
      return;
    }
    const panel = el("section", "", "panel");
    const list = el("ul");
    values.forEach(function (value) {
      const item = el("li", value);
      item.dir = "auto";
      list.appendChild(item);
    });
    panel.appendChild(list);
    container.appendChild(panel);
  }

  function register(id, title, show) {
    window.Router.register(id, {
      render: function (container, ctx) {
        let active = true;
        let cleanup = null;
        const userId = ctx.user.id;
        const status = el("p", "", "message info");
        status.setAttribute("role", "status");
        container.append(el("h1", title, "page-title"), status);

        async function load() {
          status.textContent = "جارٍ تحميل الخطة…";
          try {
            const months = await window.StudyPlan.load();
            if (!active) return;
            if (!months.length) {
              status.textContent = "ستظهر الجلسات هنا عند إضافة محتوى الشهر الأول.";
              return;
            }
            status.hidden = true;
            cleanup = show(container, months, userId);
          } catch (error) {
            if (!active) return;
            console.error(error);
            status.hidden = false;
            status.textContent = "تعذّر تحميل الخطة. تأكد من الاتصال وأعد المحاولة.";
            const retry = el("button", "إعادة المحاولة", "btn small");
            retry.type = "button";
            retry.addEventListener("click", load, { once: true });
            status.append(" ", retry);
          }
        }
        load();
        return function () {
          active = false;
          if (typeof cleanup === "function") cleanup();
        };
      },
    });
  }

  register("plan", "الخطة الدراسية", showPlan);
  register("today", "جلسات اليوم", showToday);
  register("subjects", "المواد الدراسية", function (container, months) {
    showCatalog(container, months, "subject");
  });
  register("english", "الإنجليزية التقنية", function (container, months) {
    showCatalog(container, months, "english");
  });
})();
