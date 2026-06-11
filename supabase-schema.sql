-- ════════════════════════════════════════════════════════════
--  World Cup 2026 Predictions — Schema v2
--  PRIMARY KEY = employee number (emp), no duplicate IDs
--
--  ⚠️ This RESETS all tables (drops old data).
--  Paste the whole file in Supabase > SQL Editor > Run
-- ════════════════════════════════════════════════════════════

drop table if exists predictions cascade;
drop table if exists entrants cascade;
drop table if exists results cascade;
drop table if exists users cascade;

-- Users: employee number is the unique primary key
create table users (
  emp         text primary key,
  name        text not null,
  pin_hash    text not null,
  created_at  timestamptz default now()
);

-- Predictions: one per employee per match
create table predictions (
  user_emp    text not null references users(emp) on delete cascade,
  match_id    int  not null,
  eh          int  not null default 0,
  ea          int  not null default 0,
  updated_at  timestamptz default now(),
  primary key (user_emp, match_id)
);

-- Official approved results
create table results (
  match_id    int  primary key,
  h           int  not null,
  a           int  not null,
  entered_by  text,
  entered_at  timestamptz default now()
);

-- Approved result entrants (granted by employee #190)
create table entrants (
  emp         text primary key references users(emp) on delete cascade,
  added_at    timestamptz default now()
);

create index idx_pred_match on predictions(match_id);
create index idx_pred_user  on predictions(user_emp);
