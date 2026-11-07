// صفحات مؤقتة: كل صفحة تشرح ما ستعرضه وفي أي مرحلة ستُبنى.
// عندما تُبنى الصفحة الحقيقية تُسجَّل في ملف خاص بها وتحل محل المؤقتة.
(function () {
  "use strict";

  const INFO = {
    dashboard: {
      intro: "نظرة عامة على تقدمك اليوم.",
      items: [
        "ساعات الدراسة الفعلية ونسبة الإنجاز الكلية",
        "نسبة إنجاز كل مادة",
        "عدد الجلسات والأيام المكتملة",
        "الالتزام اليومي والأسبوعي",
        "الموضوعات التي تحتاج مراجعة",
      ],
      phase: "المرحلة 10",
    },
    today: {
      intro: "جلسات اليوم الخمس مع المؤقت.",
      items: [
        "تفاصيل كل جلسة: الأهداف والمفاهيم وكلمات البحث والتطبيق العملي",
        "مؤقت 60 دقيقة: بدء وإيقاف مؤقت واستئناف وإعادة ضبط",
        "زر إكمال الجلسة، ولا تنتقل للتالية قبله",
      ],
      phase: "المرحلتين 6 و7",
    },
    plan: {
      intro: "الخطة الكاملة من 6 نوفمبر 2026 إلى 1 يونيو 2027.",
      items: [
        "كل الأيام والأسابيع والأشهر",
        "حالة كل يوم: لم يبدأ، جارٍ، مكتمل",
        "تاريخ إنجاز كل يوم",
      ],
      phase: "المرحلة 6",
    },
    subjects: {
      intro: "المواد الدراسية وتقدم كل مادة.",
      items: [
        "الشبكات (ساعتان يومياً)",
        "المادة الثانية: Linux وPython والرياضيات وأنظمة التشغيل وغيرها",
        "نسبة إنجاز كل مادة",
      ],
      phase: "المرحلة 6",
    },
    english: {
      intro: "قسم اللغة الإنجليزية التقنية.",
      items: [
        "مصطلحات الحاسوب والأمن السيبراني",
        "قراءة الوثائق التقنية والاستماع والكتابة والمحادثة",
      ],
      phase: "المرحلة 6",
    },
    review: {
      intro: "المراجعة المتباعدة والاسترجاع النشط.",
      items: [
        "الموضوعات المستحقة للمراجعة اليوم",
        "تسجيل نتيجة كل مراجعة وتعديل المواعيد حسب الصعوبة",
        "ظهور الموضوع الصعب مجدداً في الجدول",
      ],
      phase: "المرحلة 9",
    },
    labs: {
      intro: "المختبرات العملية المرتبطة بالجلسات.",
      items: [
        "تطبيقات الشبكات وLinux وغيرها",
        "مختبر الجمعة المتكامل",
        "حالة إنجاز كل مختبر",
      ],
      phase: "المرحلة 11",
    },
    progress: {
      intro: "مستوى تقدمك في الخطة.",
      items: [
        "التقدم الكلي والتقدم لكل مادة",
        "سجل الدراسة السابق",
        "نقاط الضعف",
      ],
      phase: "المرحلة 10",
    },
    reports: {
      intro: "تقارير الدراسة.",
      items: ["تقرير يومي", "تقرير أسبوعي", "تقرير شهري"],
      phase: "المرحلة 10",
    },
    notes: {
      intro: "ملاحظاتك الدراسية.",
      items: [
        "إضافة وتعديل وحذف الملاحظات",
        "ربط الملاحظة بجلسة معينة",
        "مزامنتها بين أجهزتك",
      ],
      phase: "المرحلة 11",
    },
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text) {
      node.textContent = text;
    }
    return node;
  }

  function makePage(id) {
    const info = INFO[id];
    return {
      render: function (container) {
        if (id === "dashboard") {
          const hello = el("section", "panel");
          hello.appendChild(el("h2", "", "مرحباً بك"));
          hello.appendChild(
            el(
              "p",
              "muted",
              new Date().toLocaleDateString("ar-IQ", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            )
          );
          container.appendChild(hello);
        }

        const panel = el("section", "panel");
        panel.appendChild(el("h2", "", "ما الذي ستعرضه هذه الصفحة"));
        panel.appendChild(el("p", "", info.intro));
        const list = el("ul");
        info.items.forEach(function (text) {
          list.appendChild(el("li", "", text));
        });
        panel.appendChild(list);
        container.appendChild(panel);

        container.appendChild(
          el("p", "message info", "هذه الصفحة قيد البناء، وستُفعَّل في " + info.phase + " من خطة التنفيذ.")
        );
      },
    };
  }

  Object.keys(INFO).forEach(function (id) {
    window.Router.register(id, makePage(id));
  });
})();
