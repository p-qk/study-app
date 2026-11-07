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

  async function syncCompletions(userId, completions) {
    function completedRows() {
      return client.from("session_progress").select("session_key, completed_at")
        .eq("user_id", userId).eq("status", "completed").order("session_key");
    }
    const remote = [];
    for (let offset = 0; ; offset += 500) {
      const result = await completedRows().range(offset, offset + 499);
      if (result.error) throw result.error;
      remote.push(...result.data);
      if (result.data.length < 500) break;
    }
    const known = new Set(remote.map(function (row) { return row.session_key; }));
    const pending = completions.filter(function (row) { return !known.has(row.session_key); });
    if (pending.length) {
      const rows = pending.map(function (row) {
        return { ...row, user_id: userId, status: "completed" };
      });
      const result = await client.from("session_progress")
        .upsert(rows, { onConflict: "user_id,session_key", ignoreDuplicates: true });
      if (result.error) throw result.error;
      for (const row of pending) {
        const update = await client.from("session_progress")
          .update({ status: "completed", completed_at: row.completed_at })
          .eq("user_id", userId).eq("session_key", row.session_key).neq("status", "completed");
        if (update.error) throw update.error;
      }
    }
    return remote;
  }

  async function readActiveTimer(userId) {
    const result = await client.from("active_timer").select("session_key,status,segment_started_at,accumulated_seconds,version")
      .eq("user_id", userId).maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  async function writeActiveTimer(userId, version, row) {
    const table = client.from("active_timer");
    const write = version == null
      ? table.upsert({ ...row, user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true })
      : table.update(row).eq("user_id", userId).eq("version", version);
    const result = await write.select("version").maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  async function listReviews(userId) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const result = await client.from("review_items")
        .select("item_key,stage,next_review_at,version,status")
        .eq("user_id", userId).order("item_key").range(offset, offset + 499);
      if (result.error) throw result.error;
      rows.push(...result.data);
      if (result.data.length < 500) return rows;
    }
  }

  async function saveReview(userId, itemKey, version, fields) {
    const table = client.from("review_items");
    const request = version == null
      ? table.upsert({ ...fields, user_id: userId, item_key: itemKey, session_key: itemKey },
        { onConflict: "user_id,item_key", ignoreDuplicates: true })
      : table.update(fields).eq("user_id", userId).eq("item_key", itemKey).eq("version", version);
    const result = await request.select("item_key").maybeSingle();
    if (result.error) throw result.error;
    return Boolean(result.data);
  }

  async function listNotes(userId) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const result = await client.from("notes").select("id,title,body,version,session_key")
        .eq("user_id", userId).is("deleted_at", null)
        .order("updated_at", { ascending: false }).order("id").range(offset, offset + 499);
      if (result.error) throw result.error;
      rows.push(...result.data);
      if (result.data.length < 500) return rows;
    }
  }

  async function saveNote(userId, id, version, fields) {
    const table = client.from("notes");
    const request = version == null
      ? table.insert({ ...fields, user_id: userId, id })
      : table.update(fields).eq("user_id", userId).eq("id", id)
        .eq("version", version).is("deleted_at", null);
    const result = await request.select("id").maybeSingle();
    if (result.error) throw result.error;
    return Boolean(result.data);
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
    syncCompletions,
    readActiveTimer,
    writeActiveTimer,
    listReviews,
    saveReview,
    listNotes,
    saveNote,
  };
})();
