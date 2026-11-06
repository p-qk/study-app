// طبقة الحسابات: كل التعامل مع Supabase Auth يمر من هنا فقط.
(function () {
  "use strict";

  // إذا لم تُحمَّل مكتبة Supabase نترك Auth فارغاً وتعرض الصفحة رسالة واضحة
  if (typeof window.supabase === "undefined" || !window.APP_CONFIG) {
    window.Auth = null;
    return;
  }

  const cfg = window.APP_CONFIG;
  const STORAGE_KEY = "study-app-auth";

  // نقرأ معلومات الرابط قبل أن تعالجها المكتبة (روابط استعادة كلمة المرور)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const urlInfo = {
    recovery: hashParams.get("type") === "recovery",
    errorCode: hashParams.get("error_code") || "",
  };

  const client = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        flowType: "implicit", // يعمل حتى لو فُتح رابط البريد في متصفح مختلف
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: STORAGE_KEY,
      },
    }
  );

  const OFFLINE_MESSAGE = "لا يوجد اتصال بالإنترنت. هذه العملية تحتاج إلى اتصال.";

  function friendlyError(error) {
    if (!error) {
      return "حدث خطأ غير معروف.";
    }
    const code = error.code || "";
    const message = String(error.message || "");
    const lower = message.toLowerCase();

    if (
      error.name === "AuthRetryableFetchError" ||
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower.includes("load failed")
    ) {
      return "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.";
    }

    switch (code) {
      case "invalid_credentials":
        return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      case "user_already_exists":
      case "email_exists":
        return "هذا البريد مسجَّل مسبقاً. استخدم تبويب تسجيل الدخول.";
      case "email_not_confirmed":
        return "لم يتم تأكيد البريد بعد. افتح رسالة التأكيد في بريدك.";
      case "weak_password":
        return "كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.";
      case "same_password":
        return "كلمة المرور الجديدة يجب أن تختلف عن القديمة.";
      case "signup_disabled":
        return "إنشاء الحسابات الجديدة متوقف حالياً.";
      case "over_email_send_rate_limit":
        return "تجاوزت الحد المسموح من الرسائل. انتظر ساعة ثم حاول مرة أخرى.";
      case "over_request_rate_limit":
        return "محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.";
      case "email_address_not_authorized":
        return "خدمة البريد المجانية ترسل فقط إلى عناوين أعضاء مشروع Supabase.";
      case "otp_expired":
        return "الرابط منتهي الصلاحية. اطلب رابطاً جديداً.";
      default:
        break;
    }

    if (error.status === 429 || lower.includes("rate limit")) {
      return "محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.";
    }
    return "تعذر إكمال العملية: " + message;
  }

  function toUser(user) {
    return { id: user.id, email: user.email || "" };
  }

  // قراءة الجلسة المحفوظة على الجهاز (تُستخدم عند انقطاع الإنترنت)
  function readCachedSession() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      const user =
        (parsed && parsed.user) ||
        (parsed && parsed.currentSession && parsed.currentSession.user);
      return user ? { user: user } : null;
    } catch (error) {
      return null;
    }
  }

  // مدة الانتظار القصوى قبل اعتماد الجلسة المحلية (المكتبة تعيد المحاولة طويلاً عند انقطاع الخادم)
  const INITIAL_TIMEOUT_MS = urlInfo.recovery ? 10000 : 4000;

  async function getInitialUser() {
    // بدون إنترنت: نعتمد الجلسة المحفوظة فوراً دون انتظار
    const cachedFirst = readCachedSession();
    if (!navigator.onLine && cachedFirst) {
      return { user: toUser(cachedFirst.user), limited: true };
    }

    try {
      const result = await Promise.race([
        client.auth.getSession(),
        new Promise(function (resolve) {
          window.setTimeout(function () {
            resolve(null);
          }, INITIAL_TIMEOUT_MS);
        }),
      ]);
      const session = result && result.data && result.data.session;
      if (session && session.user) {
        return { user: toUser(session.user), limited: false };
      }
    } catch (error) {
      // نكمل إلى الجلسة المحلية
    }

    // تعذر التحقق من الخادم: إن كانت الجلسة ما تزال محفوظة نستخدمها محلياً
    const cached = readCachedSession();
    if (cached) {
      return { user: toUser(cached.user), limited: true };
    }
    return { user: null, limited: false };
  }

  async function run(action) {
    if (!navigator.onLine) {
      return { ok: false, message: OFFLINE_MESSAGE };
    }
    try {
      return await action();
    } catch (error) {
      return { ok: false, message: friendlyError(error) };
    }
  }

  function signIn(email, password) {
    return run(async function () {
      const res = await client.auth.signInWithPassword({ email, password });
      if (res.error) {
        return { ok: false, message: friendlyError(res.error) };
      }
      return { ok: true, session: res.data.session };
    });
  }

  function signUp(email, password) {
    return run(async function () {
      const res = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: cfg.SITE_URL },
      });
      if (res.error) {
        return { ok: false, message: friendlyError(res.error) };
      }
      if (res.data.session) {
        return { ok: true, session: res.data.session };
      }
      const identities = res.data.user && res.data.user.identities;
      if (Array.isArray(identities) && identities.length === 0) {
        return {
          ok: false,
          message: "هذا البريد مسجَّل مسبقاً. استخدم تبويب تسجيل الدخول.",
        };
      }
      return { ok: true, needsConfirmation: true };
    });
  }

  function sendReset(email) {
    return run(async function () {
      const res = await client.auth.resetPasswordForEmail(email, {
        redirectTo: cfg.SITE_URL,
      });
      if (res.error) {
        return { ok: false, message: friendlyError(res.error) };
      }
      return { ok: true };
    });
  }

  function updatePassword(password) {
    return run(async function () {
      const res = await client.auth.updateUser({ password });
      if (res.error) {
        return { ok: false, message: friendlyError(res.error) };
      }
      return { ok: true };
    });
  }

  function signOut() {
    return run(async function () {
      const res = await client.auth.signOut();
      if (res.error) {
        return { ok: false, message: friendlyError(res.error) };
      }
      return { ok: true };
    });
  }

  function onChange(callback) {
    client.auth.onAuthStateChange(function (event, session) {
      // تأجيل بسيط حتى لا نستدعي المكتبة من داخل حدثها
      window.setTimeout(function () {
        callback(event, session);
      }, 0);
    });
  }

  window.Auth = {
    urlInfo,
    getInitialUser,
    signIn,
    signUp,
    sendReset,
    updatePassword,
    signOut,
    onChange,
    toUser,
  };
})();
