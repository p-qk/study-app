const dateElement = document.getElementById("today-date");

dateElement.textContent =
  "تاريخ اليوم: " +
  new Date().toLocaleDateString("ar-IQ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });