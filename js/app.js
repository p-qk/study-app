(function () {
  "use strict";

  const $ = function (id) {
    return document.getElementById(id);
  };

  // =====================================================
  // 1) تسجيل Service Worker (العمل بدون إنترنت وإمكانية التثبيت)
  // =====================================================
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function (error) {
      console.error("Service Worker registration failed:", error);
    });
  }

  // =====================================================
  // 2) الحسابات
  // =====================================================
  const el = {
    authWrap: $("auth-wrap"),
    loading: $("loading"),
    authView: $("auth-view"),
    appView: $("app-view"),
    tabs: $("auth-tabs"),
    tabLogin: $("tab-login"),
    tabSignup: $("tab-signup"),
    authMessage: $("auth-message"),
    appMessage: $("app-message"),
    loginForm: $("login-form"),
    loginEmail: $("login-email"),
    loginPassword: $("login-password"),
    loginBtn: $("login-btn"),
    forgotBtn: $("forgot-btn"),
    signupForm: $("signup-form"),
    signupEmail: $("signup-email"),
    signupPassword: $("signup-password"),
    signupPassword2: $("signup-password2"),
    signupBtn: $("signup-btn"),
    recoveryForm: $("recovery-form"),
    recoveryPassword: $("recovery-password"),
    recoveryPassword2: $("recovery-password2"),
    recoveryBtn: $("recovery-btn"),
    accountEmail: $("account-email"),
    limitedNote: $("limited-note"),
  };

  const state = {
    ready: false,
    user: null,
    limited: false,
    recovery: false,
    tab: "login",
  };

  const MIN_PASSWORD = 8;

  function setMessage(target, text, type) {
    target.textContent = text || "";
    target.className = "message " + (type || "info");
    target.hidden = !text;
  }

  function setBusy(button, busy, busyText) {
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = busyText;
    } else if (button.dataset.label) {
      button.textContent = button.dataset.label;
    }
    button.disabled = busy;
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function render() {
    if (!state.ready) {
      return;
    }
    el.loading.hidden = true;
    const inApp = Boolean(state.user) && !state.recovery;
    el.authWrap.hidden = inApp;
    el.authView.hidden = inApp;
    el.appView.hidden = !inApp;

    if (inApp) {
      el.accountEmail.textContent = state.user.email;
      el.limitedNote.hidden = !state.limited;
      window.Router.show(state.user);
      return;
    }

    window.Router.hide();
    el.tabs.hidden = state.recovery;
    el.loginForm.hidden = state.recovery || state.tab !== "login";
    el.signupForm.hidden = state.recovery || state.tab !== "signup";
    el.recoveryForm.hidden = !state.recovery;
    el.tabLogin.classList.toggle("active", state.tab === "login");
    el.tabSignup.classList.toggle("active", state.tab === "signup");
  }

  function setTab(tab) {
    state.tab = tab;
    setMessage(el.authMessage, "");
    render();
  }

  function applySession(session) {
    if (session && session.user) {
      state.user = window.Auth.toUser(session.user);
      state.limited = false;
    }
    render();
  }

  function cleanUrl() {
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (error) {
      // لا يؤثر على عمل التطبيق
    }
  }

  function startApp() {
    if (!window.Auth) {
      el.loading.querySelector("p").textContent =
        "تعذر تحميل مكتبة الحسابات. تأكد من وجود الملف js/vendor/supabase.js ومن صحة اسمه، ثم حدّث الصفحة.";
      return;
    }

    el.tabLogin.addEventListener("click", function () {
      setTab("login");
    });
    el.tabSignup.addEventListener("click", function () {
      setTab("signup");
    });

    // ---------- تسجيل الدخول ----------
    el.loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setMessage(el.authMessage, "");
      const email = el.loginEmail.value.trim();
      const password = el.loginPassword.value;
      if (!isEmail(email)) {
        setMessage(el.authMessage, "اكتب بريداً إلكترونياً صحيحاً.", "error");
        return;
      }
      if (!password) {
        setMessage(el.authMessage, "اكتب كلمة المرور.", "error");
        return;
      }
      setBusy(el.loginBtn, true, "جارٍ الدخول...");
      const result = await window.Auth.signIn(email, password);
      setBusy(el.loginBtn, false);
      if (!result.ok) {
        setMessage(el.authMessage, result.message, "error");
        return;
      }
      el.loginPassword.value = "";
      applySession(result.session);
    });

    // ---------- نسيت كلمة المرور ----------
    el.forgotBtn.addEventListener("click", async function () {
      setMessage(el.authMessage, "");
      const email = el.loginEmail.value.trim();
      if (!isEmail(email)) {
        setMessage(el.authMessage, "اكتب بريدك الإلكتروني في الخانة أعلاه ثم اضغط \"نسيت كلمة المرور\".", "error");
        return;
      }
      setBusy(el.forgotBtn, true, "جارٍ الإرسال...");
      const result = await window.Auth.sendReset(email);
      setBusy(el.forgotBtn, false);
      if (!result.ok) {
        setMessage(el.authMessage, result.message, "error");
        return;
      }
      setMessage(
        el.authMessage,
        "إذا كان البريد مسجَّلاً فسيصلك رابط الاستعادة خلال دقائق. تحقق أيضاً من مجلد الرسائل غير الهامة.",
        "success"
      );
    });

    // ---------- إنشاء حساب ----------
    el.signupForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setMessage(el.authMessage, "");
      const email = el.signupEmail.value.trim();
      const password = el.signupPassword.value;
      const password2 = el.signupPassword2.value;
      if (!isEmail(email)) {
        setMessage(el.authMessage, "اكتب بريداً إلكترونياً صحيحاً.", "error");
        return;
      }
      if (password.length < MIN_PASSWORD) {
        setMessage(el.authMessage, "كلمة المرور يجب ألا تقل عن 8 أحرف.", "error");
        return;
      }
      if (password !== password2) {
        setMessage(el.authMessage, "كلمتا المرور غير متطابقتين.", "error");
        return;
      }
      setBusy(el.signupBtn, true, "جارٍ إنشاء الحساب...");
      const result = await window.Auth.signUp(email, password);
      setBusy(el.signupBtn, false);
      if (!result.ok) {
        setMessage(el.authMessage, result.message, "error");
        return;
      }
      el.signupPassword.value = "";
      el.signupPassword2.value = "";
      if (result.needsConfirmation) {
        setMessage(
          el.authMessage,
          "تم إنشاء الحساب. أرسلنا رسالة تأكيد إلى بريدك، افتحها ثم سجّل الدخول.",
          "success"
        );
        return;
      }
      applySession(result.session);
    });

    // ---------- كلمة مرور جديدة (بعد رابط الاستعادة) ----------
    el.recoveryForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setMessage(el.authMessage, "");
      const password = el.recoveryPassword.value;
      const password2 = el.recoveryPassword2.value;
      if (password.length < MIN_PASSWORD) {
        setMessage(el.authMessage, "كلمة المرور يجب ألا تقل عن 8 أحرف.", "error");
        return;
      }
      if (password !== password2) {
        setMessage(el.authMessage, "كلمتا المرور غير متطابقتين.", "error");
        return;
      }
      setBusy(el.recoveryBtn, true, "جارٍ الحفظ...");
      const result = await window.Auth.updatePassword(password);
      setBusy(el.recoveryBtn, false);
      if (!result.ok) {
        setMessage(el.authMessage, result.message, "error");
        return;
      }
      el.recoveryPassword.value = "";
      el.recoveryPassword2.value = "";
      state.recovery = false;
      cleanUrl();
      render();
      setMessage(el.appMessage, "تم تغيير كلمة المرور بنجاح.", "success");
    });

    // ---------- تسجيل الخروج (أي زر يحمل data-action="logout") ----------
    document.addEventListener("click", async function (event) {
      const button = event.target.closest('[data-action="logout"]');
      if (!button || button.disabled) {
        return;
      }
      setMessage(el.appMessage, "");
      setBusy(button, true, "جارٍ الخروج...");
      const result = await window.Auth.signOut();
      setBusy(button, false);
      if (!result.ok) {
        setMessage(el.appMessage, result.message, "error");
        return;
      }
      state.user = null;
      state.limited = false;
      state.recovery = false;
      state.tab = "login";
      render();
      setMessage(el.authMessage, "تم تسجيل الخروج.", "success");
    });

    // ---------- أحداث المكتبة (تجديد الجلسة، الخروج...) ----------
    window.Auth.onChange(function (event, session) {
      if (!state.ready) {
        return;
      }
      if (event === "PASSWORD_RECOVERY") {
        state.recovery = true;
      }
      if (event === "SIGNED_OUT") {
        state.user = null;
        state.limited = false;
        state.recovery = false;
      } else if (session && session.user) {
        state.user = window.Auth.toUser(session.user);
        state.limited = false;
      }
      render();
    });

    // عند عودة الإنترنت: نحاول تجديد الجلسة المحلية
    window.addEventListener("online", function () {
      if (state.user && state.limited) {
        window.Auth.getInitialUser().then(function (initial) {
          if (initial.user && !initial.limited) {
            state.user = initial.user;
            state.limited = false;
            render();
          }
        });
      }
    });

    // ---------- البداية ----------
    window.Auth.getInitialUser().then(function (initial) {
      state.user = initial.user;
      state.limited = initial.limited;

      const info = window.Auth.urlInfo;
      if (info.recovery && initial.user) {
        state.recovery = true;
      }
      state.ready = true;
      render();

      if (info.errorCode) {
        setMessage(
          el.authMessage,
          "رابط البريد غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً من \"نسيت كلمة المرور\".",
          "error"
        );
      } else if (info.recovery && !initial.user) {
        setMessage(
          el.authMessage,
          "تعذر التحقق من رابط الاستعادة. اطلب رابطاً جديداً.",
          "error"
        );
      }
      if (info.recovery || info.errorCode) {
        cleanUrl();
      }
    });
  }

  startApp();
})();
