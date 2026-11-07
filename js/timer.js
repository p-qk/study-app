(function () {
  "use strict";
  function open(userId, sessions) {
    if (!userId) throw new Error("User required");
    const key = "study-progress-v1-" + userId;
    function read() {
      const raw = localStorage.getItem(key);
      const state = raw ? JSON.parse(raw) : { records: {} };
      if (!state || !state.records || typeof state.records !== "object") {
        throw new Error("Invalid progress");
      }
      return state;
    }
    function elapsed(record, now) {
      if (!record) return 0;
      return (record.seconds || 0) +
        (record.startedAt == null ? 0 : Math.max(0, (now - record.startedAt) / 1000));
    }
    function current(state) {
      return sessions.find(function (session) {
        return !state.records[session.id]?.completedAt;
      });
    }
    async function act(id, action) {
      if (!navigator.locks) throw new Error("المتصفح لا يدعم حماية المؤقت بين النوافذ.");
      await navigator.locks.request(key, function () {
        const state = read();
        const session = current(state);
        if (!session || session.id !== id) throw new Error("حدّث الصفحة لعرض الجلسة الحالية.");
        const now = Date.now();
        const record = state.records[id] || { seconds: 0, startedAt: null };
        if (action === "start") {
          if (record.startedAt == null) record.startedAt = now;
        } else if (action === "pause") {
          record.seconds = elapsed(record, now);
          record.startedAt = null;
        } else if (action === "reset") {
          record.seconds = 0;
          record.startedAt = null;
        } else if (action === "complete") {
          const seconds = elapsed(record, now);
          if (seconds < session.minutes * 60) throw new Error("أكمل وقت الجلسة أولاً.");
          record.seconds = seconds;
          record.startedAt = null;
          record.completedAt = new Date(now).toISOString();
        } else {
          throw new Error("Invalid timer action");
        }
        state.records[id] = record;
        localStorage.setItem(key, JSON.stringify(state));
      });
    }
    async function sync() {
      const records = read().records;
      const completions = Object.entries(records)
        .filter(function ([, record]) { return record.completedAt; })
        .map(function ([id, record]) {
          return { session_key: id, completed_at: record.completedAt };
        });
      const remote = await window.Auth.syncCompletions(userId, completions);
      await navigator.locks.request(key, function () {
        const state = read();
        let changed = false;
        remote.forEach(function (row) {
          const record = state.records[row.session_key];
          if (record?.completedAt) return;
          state.records[row.session_key] = {
            seconds: record?.seconds || 0,
            startedAt: null,
            completedAt: row.completed_at,
          };
          changed = true;
        });
        if (changed) localStorage.setItem(key, JSON.stringify(state));
      });
    }
    return { read: read, elapsed: elapsed, current: current, act: act, sync: sync };
  }
  window.StudyTimer = { open: open };
})();
