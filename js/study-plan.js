(function () {
  "use strict";

  const firstDate = Date.UTC(2026, 10, 6);
  const totalDays = 208;
  const dayMs = 86400000;
  const textFields = ["title", "subject", "practice", "review"];
  const listFields = ["objectives", "concepts", "keywords", "english", "resources"];

  function nonEmpty(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function readDay(day, number) {
    const sessions = day && day.sessions;
    if (!day || day.number !== number || !Array.isArray(sessions) || sessions.length !== 5 ||
        sessions.some(function (session) {
          return !session ||
            !textFields.every(function (key) { return nonEmpty(session[key]); }) ||
            !listFields.every(function (key) {
              return Array.isArray(session[key]) && session[key].every(nonEmpty);
            });
        }) ||
        sessions.filter(function (session) { return session.subject === "الشبكات"; }).length !== 2) {
      throw new Error("Invalid study sessions on day " + number);
    }
    return {
      number: number,
      date: new Date(firstDate + (number - 1) * dayMs),
      sessions: sessions.map(function (session, index) {
        return {
          ...session,
          id: "d" + String(number).padStart(3, "0") + "-s" + (index + 1),
          minutes: 60,
        };
      }),
    };
  }

  async function readJson(file) {
    const response = await fetch("./data/" + file);
    if (!response.ok) {
      throw new Error("Cannot load " + file + ": " + response.status);
    }
    return response.json();
  }

  async function load() {
    const index = await readJson("plan-index.json");
    if (!index || !Array.isArray(index.months) || index.months.some(function (file, index) {
      return file !== "month-" + String(index + 1).padStart(2, "0") + ".json";
    })) {
      throw new Error("Invalid study plan index");
    }
    let number = 0;
    const months = [];
    for (const file of index.months) {
      const month = await readJson(file);
      if (!month || !nonEmpty(month.title) || !Array.isArray(month.days) ||
          !month.days.length || month.days.length > 31 || number + month.days.length > totalDays) {
        throw new Error("Invalid study month: " + file);
      }
      const days = month.days.map(function (day) { return readDay(day, ++number); });
      months.push({ title: month.title, days: days });
    }
    return months;
  }

  window.StudyPlan = { load: load, totalDays: totalDays };
})();
