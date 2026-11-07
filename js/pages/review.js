(function () {
  "use strict";

  const intervals = [1, 3, 7, 14, 30];
  const format = new Intl.DateTimeFormat("ar-IQ", { dateStyle: "long", timeZone: "UTC" });

  function element(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function dateKey(timestamp, offset = 0) {
    const date = new Date(timestamp);
    const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + offset));
    return day.toISOString().slice(0, 10);
  }

  window.Router.register("review", {
    render: function (container, ctx) {
      const userId = ctx.user.id;
      let active = true;
      const message = element("p", "", "message info");
      message.setAttribute("role", "status");
      const body = element("div", "");
      container.append(element("h1", "مركز المراجعة", "page-title"), message, body);

      async function load() {
        message.textContent = "جارٍ تحميل المراجعات…";
        body.replaceChildren();
        try {
          const months = await window.StudyPlan.load();
          if (!active) return;
          const sessions = months.flatMap(month => month.days.flatMap(day => day.sessions));
          if (!sessions.length) {
            message.textContent = "تظهر المراجعات بعد إضافة الخطة وإكمال جلسات الدراسة.";
            return;
          }
          const [completed, reviews] = await Promise.all([
            window.Auth.syncCompletions(userId, []),
            window.Auth.listReviews(userId),
          ]);
          if (!active) return;
          const dates = new Map(completed.map(row => [row.session_key, row.completed_at]));
          const local = window.StudyTimer.open(userId, sessions).read().records;
          Object.entries(local).forEach(function ([id, record]) {
            if (record.completedAt && !dates.has(id)) dates.set(id, record.completedAt);
          });
          const byId = new Map(reviews.map(row => [row.item_key, row]));
          const today = dateKey(Date.now());
          const items = sessions.filter(session => !session.trackingOnly &&
            (dates.has(session.id) || byId.has(session.id)))
            .map(function (session) {
              const review = byId.get(session.id);
              return { session, review, due: review?.next_review_at || dateKey(dates.get(session.id), 1) };
            })
            .filter(item => item.review?.status !== "mastered")
            .sort((a, b) => a.due.localeCompare(b.due));
          const due = items.filter(item => item.due <= today);
          message.textContent = items.length
            ? "المراجعات المستحقة اليوم: " + due.length
            : "أكمل جلسة دراسية لإضافة أول مراجعة. موعدها في اليوم التالي للإكمال.";
          due.forEach(function ({ session, review }) {
            const card = element("section", "", "panel");
            card.append(element("h2", session.title), element("p", session.review));
            const buttons = element("div", "", "timer-actions");
            [[5, "صعبة"], [3, "متوسطة"], [1, "سهلة"]].forEach(function ([difficulty, label]) {
              const button = element("button", label, "btn small");
              button.type = "button";
              button.addEventListener("click", async function () {
                Array.from(buttons.children).forEach(control => { control.disabled = true; });
                try {
                  const oldStage = review?.stage ?? 0;
                  const stage = difficulty === 5 ? 0 : difficulty === 3
                    ? Math.min(4, oldStage + 1) : Math.min(4, oldStage + 2);
                  const now = Date.now();
                  const saved = await window.Auth.saveReview(userId, session.id, review?.version, {
                    stage,
                    difficulty,
                    next_review_at: dateKey(now, intervals[stage]),
                    last_reviewed_at: new Date(now).toISOString(),
                  });
                  if (!active) return;
                  await load();
                  if (active && !saved) message.textContent = "تغيّر التقييم على جهاز آخر. عُرضت أحدث المواعيد.";
                } catch (error) {
                  if (!active) return;
                  message.textContent = "تعذّر حفظ التقييم. تحقق من الاتصال وحاول مجددًا.";
                  Array.from(buttons.children).forEach(control => { control.disabled = false; });
                }
              });
              buttons.appendChild(button);
            });
            card.appendChild(buttons);
            body.appendChild(card);
          });
          const upcoming = items.filter(item => item.due > today);
          if (upcoming.length) {
            const list = element("ul", "");
            upcoming.forEach(item => list.appendChild(element("li",
              item.session.title + " · " + format.format(new Date(item.due)))));
            body.append(element("h2", "المراجعات القادمة"), list);
          }
        } catch (error) {
          if (!active) return;
          message.textContent = "تعذّر تحميل المراجعات. تحقق من الاتصال وحاول مجددًا.";
          const retry = element("button", "إعادة المحاولة", "btn small");
          retry.type = "button";
          retry.addEventListener("click", load, { once: true });
          body.appendChild(retry);
        }
      }
      load();
      return function () { active = false; };
    },
  });
})();
