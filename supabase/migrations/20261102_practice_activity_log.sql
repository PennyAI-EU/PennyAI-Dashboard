-- APPLIED 2 Nov 2026. Practice usage log + per-student summary (see server.js PRACTICE section).
create table if not exists public.practice_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  event text not null check (event in ('open','finish','blocked')),
  set_id text, level text, kind text, score integer, total integer, seconds integer,
  created_at timestamptz not null default now()
);
create index if not exists practice_activity_user_time on public.practice_activity (user_id, created_at desc);
create index if not exists practice_activity_time on public.practice_activity (created_at desc);
alter table public.practice_activity enable row level security;
revoke all on public.practice_activity from anon, authenticated;
grant select, insert on public.practice_activity to service_role;
-- practice_usage_summary(p_days) : see the live database for the full definition.
