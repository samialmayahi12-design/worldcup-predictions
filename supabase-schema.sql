-- ════════════════════════════════════════════════════════════
--  قاعدة بيانات دوري توقعات كأس العالم 2026
--  انسخ هذا الملف كاملًا والصقه في Supabase > SQL Editor > Run
-- ════════════════════════════════════════════════════════════

-- جدول المستخدمين
create table if not exists users (
  name        text primary key,
  emp         text not null,
  pin_hash    text not null,
  created_at  timestamptz default now()
);

-- جدول التوقعات (توقع واحد لكل مستخدم لكل مباراة)
create table if not exists predictions (
  user_name   text not null references users(name) on delete cascade,
  match_id    int  not null,
  eh          int  not null default 0,
  ea          int  not null default 0,
  updated_at  timestamptz default now(),
  primary key (user_name, match_id)
);

-- جدول النتائج الرسمية المعتمدة
create table if not exists results (
  match_id    int  primary key,
  h           int  not null,
  a           int  not null,
  entered_by  text,
  entered_at  timestamptz default now()
);

-- جدول مدخلي النتائج المعتمدين (يضيفهم المدير صاحب الرقم 190)
create table if not exists entrants (
  name        text primary key references users(name) on delete cascade,
  added_at    timestamptz default now()
);

-- مؤشرات لتسريع الاستعلامات
create index if not exists idx_pred_match on predictions(match_id);
create index if not exists idx_pred_user  on predictions(user_name);

-- ملاحظة: التطبيق يصل لهذه الجداول عبر مفتاح service_role من الخادم فقط،
-- لذا تُترك RLS غير مفعّلة. لا تكشف مفتاح service_role في كود المتصفح.
