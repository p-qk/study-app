(function () {
  "use strict";

  function el(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  window.Router.register("notes", {
    render: function (container, ctx) {
      const userId = ctx.user.id;
      let active = true;
      let editing = null;
      let busy = false;
      let notes = [];
      const status = el("p", "", "message info");
      status.setAttribute("role", "status");
      const form = el("form", "", "panel form");
      const heading = el("h2", "ملاحظة جديدة");
      const title = el("input", "");
      title.type = "text";
      title.maxLength = 200;
      const body = el("textarea", "");
      body.maxLength = 100000;
      body.rows = 6;
      const session = el("select", "");
      session.appendChild(new Option("ملاحظة عامة", ""));
      const save = el("button", "حفظ الملاحظة", "btn primary");
      save.type = "submit";
      const cancel = el("button", "إلغاء التعديل", "btn small");
      cancel.type = "button";
      cancel.hidden = true;
      const list = el("div", "");
      function field(label, control) {
        const wrapper = el("label", label);
        wrapper.appendChild(control);
        return wrapper;
      }
      form.append(heading, field("العنوان", title), field("الملاحظة", body),
        field("الجلسة المرتبطة", session), save, cancel);
      container.append(el("h1", "الملاحظات", "page-title"), status, form, list);

      function selectNote(note) {
        editing = note;
        heading.textContent = note ? "تعديل الملاحظة" : "ملاحظة جديدة";
        title.value = note?.title || "";
        body.value = note?.body || "";
        const key = note?.session_key || "";
        if (key && !Array.from(session.options).some(option => option.value === key)) {
          session.appendChild(new Option(key, key));
        }
        session.value = key;
        cancel.hidden = !note;
        title.focus();
      }
      cancel.addEventListener("click", function () { if (!busy) selectNote(null); });

      function draw() {
        list.replaceChildren();
        if (!notes.length) list.appendChild(el("p", "لا توجد ملاحظات محفوظة.", "muted"));
        notes.forEach(function (note) {
          const card = el("article", "", "panel");
          const content = el("p", note.body);
          content.style.whiteSpace = "pre-wrap";
          const edit = el("button", "تعديل", "btn small");
          const remove = el("button", "حذف", "btn small");
          edit.addEventListener("click", function () { if (!busy) selectNote(note); });
          remove.addEventListener("click", function () {
            if (!busy && window.confirm("حذف هذه الملاحظة من حسابك؟")) {
              persist(note, { deleted_at: new Date().toISOString() });
            }
          });
          card.append(el("h2", note.title || "ملاحظة"), content);
          if (note.session_key) {
            const option = Array.from(session.options).find(item => item.value === note.session_key);
            card.appendChild(el("p", option?.text || note.session_key, "muted"));
          }
          card.append(edit, remove);
          list.appendChild(card);
        });
      }

      async function load() {
        try {
          const rows = await window.Auth.listNotes(userId);
          if (!active) return;
          notes = rows;
          draw();
        } catch (error) {
          if (!active) return;
          status.textContent = "تعذّر تحميل الملاحظات. تحقق من الاتصال ثم حدّث الصفحة.";
        }
      }

      async function persist(note, fields) {
        busy = true;
        const controls = [title, body, session, save, cancel];
        controls.forEach(control => { control.disabled = true; });
        try {
          const saved = await window.Auth.saveNote(userId, note?.id || crypto.randomUUID(), note?.version, fields);
          if (!active) return;
          if (saved && (!fields.deleted_at || editing?.id === note.id)) selectNote(null);
          status.textContent = saved
            ? fields.deleted_at ? "حُذفت الملاحظة." : "حُفظت الملاحظة."
            : "تغيّرت الملاحظة في جهاز آخر. مسودتك ما زالت في الحقول؛ راجع أحدث نسخة أدناه.";
          await load();
        } catch (error) {
          if (active) status.textContent = "تعذّر الحفظ. تحقق من الاتصال وحاول مجددًا.";
        } finally {
          busy = false;
          controls.forEach(control => { control.disabled = false; });
        }
      }

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (busy) return;
        const fields = { title: title.value.trim(), body: body.value.trim(), session_key: session.value || null };
        if (!fields.title && !fields.body) {
          status.textContent = "اكتب عنوانًا أو نصًا للملاحظة.";
          return;
        }
        persist(editing, fields);
      });

      window.StudyPlan.load().then(function (months) {
        if (!active) return;
        months.forEach(month => month.days.forEach(day => day.sessions.forEach(function (item) {
          const option = Array.from(session.options).find(value => value.value === item.id);
          const label = "اليوم " + day.number + " · " + item.title;
          if (option) option.text = label;
          else session.appendChild(new Option(label, item.id));
        })));
        draw();
      }).catch(function () {
        if (active) session.options[0].text = "ملاحظة عامة · تعذّر تحميل الجلسات";
      });
      load();
      return function () { active = false; };
    },
  });
})();
