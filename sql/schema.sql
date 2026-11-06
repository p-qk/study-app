-- =====================================================================
-- schema.sql  |  تطبيق التأسيس الأكاديمي  |  المرحلة 3
-- قاعدة البيانات: الجداول + الحماية (RLS) + المشغّلات
-- يُنفَّذ مرة واحدة في Supabase: SQL Editor
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) دالة مشتركة: عند أي تعديل على صف
--    - تمنع تغيير صاحب الصف (user_id) وتاريخ الإنشاء
--    - تضع وقت التعديل من الخادم (لا من ساعة الجهاز)
--    - ترفع رقم الإصدار (version) لكشف التعارض بين الأجهزة
-- ---------------------------------------------------------------------
create or replace function public.set_row_meta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id    := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.version    := old.version + 1;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) الجداول القابلة للتعديل (فيها version و updated_at)
-- ---------------------------------------------------------------------

-- إعدادات المستخدم (صف واحد لكل مستخدم)
create table public.user_settings (
  user_id          uuid primary key default auth.uid()
                   references auth.users (id) on delete cascade,
  plan_start_date  date  not null default date '2026-11-06',
  theme            text  not null default 'system'
                   check (theme in ('system', 'light', 'dark')),
  review_intervals jsonb not null default '[1,3,7,14,30]'::jsonb,
  extra            jsonb not null default '{}'::jsonb,
  version          integer     not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- حالة المؤقت (صف واحد لكل مستخدم)
-- الوقت المنقضي = accumulated_seconds + (الآن - segment_started_at) إذا كان running
create table public.active_timer (
  user_id             uuid primary key default auth.uid()
                      references auth.users (id) on delete cascade,
  session_key         text check (char_length(session_key) between 1 and 64),
  status              text not null default 'idle'
                      check (status in ('idle', 'running', 'paused')),
  segment_started_at  timestamptz,
  accumulated_seconds integer not null default 0
                      check (accumulated_seconds between 0 and 86400),
  device_id           text check (char_length(device_id) <= 100),
  version             integer     not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (status = 'idle' or session_key is not null),
  check (status <> 'running' or segment_started_at is not null)
);

-- تقدم كل جلسة (صف واحد لكل جلسة لكل مستخدم -> لا تكرار)
create table public.session_progress (
  user_id      uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  session_key  text not null check (char_length(session_key) between 1 and 64),
  status       text not null default 'not_started'
               check (status in ('not_started', 'in_progress', 'completed')),
  started_at   timestamptz,
  completed_at timestamptz,
  self_rating  smallint check (self_rating between 1 and 5),
  version      integer     not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, session_key),
  check ((status = 'completed') = (completed_at is not null))
);
create index session_progress_sync_idx
  on public.session_progress (user_id, updated_at);

-- عناصر المراجعة المتباعدة
create table public.review_items (
  user_id          uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  item_key         text not null check (char_length(item_key) between 1 and 64),
  session_key      text check (char_length(session_key) <= 64),
  stage            smallint not null default 0 check (stage between 0 and 20),
  next_review_at   date not null,
  last_reviewed_at timestamptz,
  difficulty       smallint not null default 3 check (difficulty between 1 and 5),
  status           text not null default 'active'
                   check (status in ('active', 'mastered')),
  version          integer     not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, item_key)
);
create index review_items_due_idx
  on public.review_items (user_id, next_review_at);
create index review_items_sync_idx
  on public.review_items (user_id, updated_at);

-- الملاحظات (الحذف "ناعم" عبر deleted_at حتى تصل المزامنة لكل الأجهزة)
create table public.notes (
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  id          uuid not null,
  session_key text check (char_length(session_key) <= 64),
  title       text not null default '' check (char_length(title) <= 200),
  body        text not null default '' check (char_length(body) <= 100000),
  deleted_at  timestamptz,
  version     integer     not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);
create index notes_sync_idx on public.notes (user_id, updated_at);

-- ---------------------------------------------------------------------
-- 3) جداول السجلات (تُضاف فقط ولا تُعدَّل)
--    المعرّف id يولّده الجهاز، فإعادة إرسال السجل نفسه لا تنشئ نسخة مكررة
-- ---------------------------------------------------------------------

-- مقاطع وقت الدراسة الفعلي (لا تشمل وقت الإيقاف)
create table public.time_segments (
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  id          uuid not null,
  session_key text not null check (char_length(session_key) between 1 and 64),
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  seconds     integer not null check (seconds between 0 and 86400),
  device_id   text check (char_length(device_id) <= 100),
  created_at  timestamptz not null default now(),
  primary key (user_id, id),
  check (ended_at >= started_at)
);
create index time_segments_time_idx
  on public.time_segments (user_id, started_at);
create index time_segments_session_idx
  on public.time_segments (user_id, session_key);

-- نتائج المراجعات
create table public.review_log (
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  id          uuid not null,
  item_key    text not null check (char_length(item_key) between 1 and 64),
  reviewed_at timestamptz not null default now(),
  result      text not null check (result in ('forgot', 'hard', 'good', 'easy')),
  device_id   text check (char_length(device_id) <= 100),
  created_at  timestamptz not null default now(),
  primary key (user_id, id)
);
create index review_log_item_idx
  on public.review_log (user_id, item_key, reviewed_at);

-- ---------------------------------------------------------------------
-- 4) المشغّلات (على الجداول القابلة للتعديل فقط)
-- ---------------------------------------------------------------------
create trigger user_settings_meta  before update on public.user_settings
  for each row execute function public.set_row_meta();
create trigger active_timer_meta   before update on public.active_timer
  for each row execute function public.set_row_meta();
create trigger session_progress_meta before update on public.session_progress
  for each row execute function public.set_row_meta();
create trigger review_items_meta   before update on public.review_items
  for each row execute function public.set_row_meta();
create trigger notes_meta          before update on public.notes
  for each row execute function public.set_row_meta();

-- ---------------------------------------------------------------------
-- 5) الأمان: RLS + الصلاحيات
-- ---------------------------------------------------------------------
alter table public.user_settings    enable row level security;
alter table public.active_timer     enable row level security;
alter table public.session_progress enable row level security;
alter table public.review_items     enable row level security;
alter table public.notes            enable row level security;
alter table public.time_segments    enable row level security;
alter table public.review_log       enable row level security;

-- نبدأ من الصفر: نسحب كل الصلاحيات من الزائر (anon) ومن المستخدم المسجل (authenticated)
-- ثم نمنح المستخدم المسجل ما يحتاجه فقط في الخطوة التالية
revoke all on table
  public.user_settings, public.active_timer, public.session_progress,
  public.review_items, public.notes, public.time_segments, public.review_log
from anon, authenticated;

-- المستخدم المسجل: صلاحيات محدودة، وتقيّدها سياسات RLS بصفوفه هو فقط
grant select, insert, update, delete on table
  public.user_settings, public.active_timer, public.session_progress,
  public.review_items, public.notes
to authenticated;

grant select, insert, delete on table
  public.time_segments, public.review_log
to authenticated;

-- سياسات RLS: كل مستخدم يرى ويعدّل صفوفه فقط
do $$
declare
  t text;
begin
  -- الجداول القابلة للتعديل: قراءة + إضافة + تعديل + حذف
  foreach t in array array[
    'user_settings', 'active_timer', 'session_progress', 'review_items', 'notes'
  ]
  loop
    execute format(
      'create policy "own rows select" on public.%I for select to authenticated
         using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows insert" on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows update" on public.%I for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows delete" on public.%I for delete to authenticated
         using ((select auth.uid()) = user_id)', t);
  end loop;

  -- جداول السجلات: قراءة + إضافة + حذف (بلا تعديل)
  foreach t in array array['time_segments', 'review_log']
  loop
    execute format(
      'create policy "own rows select" on public.%I for select to authenticated
         using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows insert" on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows delete" on public.%I for delete to authenticated
         using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;
