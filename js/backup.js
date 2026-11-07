(function () {
  "use strict";

  function mount(panel, userId) {
    const progressKey = "study-progress-v1-" + userId;
    const labsKey = "study-labs-v1-" + userId;
    const validId = id => typeof id === "string" && /^(?:preview-[0-9]+-)?d[0-9]{3}-s[1-7]$/.test(id);
    const read = (key, fallback) => JSON.parse(localStorage.getItem(key) || fallback);
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    const file = document.createElement("input");
    file.type = "file";
    file.accept = ".json,application/json";
    file.hidden = true;

    function button(label, handler) {
      const control = document.createElement("button");
      control.type = "button";
      control.className = "btn small";
      control.textContent = label;
      control.addEventListener("click", handler);
      return control;
    }

    const download = button("تصدير نسخة JSON", async function () {
      download.disabled = true;
      try {
        const progress = read(progressKey, '{"records":{}}');
        const completed = Object.entries(progress.records)
          .filter(([id, record]) => validId(id) && record.completedAt)
          .map(([id, record]) => ({ id, completedAt: record.completedAt, seconds: record.seconds || 0 }));
        const payload = { format: "study-progress", version: 1, userId, completed,
          labs: read(labsKey, "[]").filter(validId) };
        const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "study-progress-backup.json";
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = "تم تجهيز ملف النسخة الاحتياطية.";
      } catch (error) {
        status.textContent = "تعذّر تصدير النسخة الاحتياطية.";
      } finally {
        download.disabled = false;
      }
    });
    const upload = button("استيراد نسخة JSON", function () { file.click(); });
    file.addEventListener("change", async function () {
      const selected = file.files[0];
      file.value = "";
      if (!selected) return;
      upload.disabled = true;
      try {
        if (selected.size > 1000000) throw new Error("حجم الملف أكبر من الحد المسموح.");
        const data = JSON.parse(await selected.text());
        if (data?.format !== "study-progress" || data.version !== 1 ||
            !Array.isArray(data.completed) || !Array.isArray(data.labs) ||
            !data.labs.every(validId) || !data.completed.every(item =>
              item && validId(item.id) && typeof item.completedAt === "string" &&
              Number.isFinite(Date.parse(item.completedAt)) &&
              Number.isFinite(item.seconds) && item.seconds >= 0)) {
          throw new Error("الملف ليس نسخة تقدّم صالحة.");
        }
        if (data.userId !== userId) throw new Error("هذه النسخة تخص حسابًا آخر.");
        if (!navigator.locks) throw new Error("المتصفح لا يدعم الحفظ الآمن.");
        if (!window.confirm("إضافة الإنجازات الموجودة في هذه النسخة إلى حسابك؟")) return;
        await navigator.locks.request(progressKey, function () {
          const progress = read(progressKey, '{"records":{}}');
          data.completed.forEach(function (item) {
            if (progress.records[item.id]?.completedAt) return;
            progress.records[item.id] = { seconds: item.seconds, completedAt: item.completedAt, startedAt: null };
            if (progress.timerPending?.id === item.id) delete progress.timerPending;
          });
          localStorage.setItem(progressKey, JSON.stringify(progress));
        });
        await navigator.locks.request(labsKey, function () {
          const merged = new Set([...read(labsKey, "[]"), ...data.labs]);
          localStorage.setItem(labsKey, JSON.stringify(Array.from(merged)));
        });
        status.textContent = "تم استيراد الإنجازات. افتح جلسات اليوم لمزامنة الجلسات المكتملة.";
      } catch (error) {
        status.textContent = "تعذّر إكمال الاستيراد. " + error.message;
      } finally {
        upload.disabled = false;
      }
    });
    panel.append(download, upload, file, status);
  }

  window.StudyBackup = { mount: mount };
})();
