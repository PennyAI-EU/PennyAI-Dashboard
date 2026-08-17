-- Penny AI Staging: Learner Dashboard specification v2 foundation.
-- This migration is additive and preserves the legacy score fields while
-- the application and n8n workflows are updated to use the new model.

alter table public.users
  add column if not exists pronunciation_enabled boolean not null default false,
  add column if not exists subscription_period_started_at timestamptz,
  add column if not exists subscription_period_ends_at timestamptz,
  add column if not exists subscription_minutes_allocated integer;

alter table public.users
  drop constraint if exists users_subscription_period_is_valid,
  add constraint users_subscription_period_is_valid check (
    subscription_period_started_at is null
    or subscription_period_ends_at is null
    or subscription_period_ends_at > subscription_period_started_at
  ),
  drop constraint if exists users_subscription_minutes_allocated_is_valid,
  add constraint users_subscription_minutes_allocated_is_valid check (
    subscription_minutes_allocated is null or subscription_minutes_allocated >= 0
  );

alter table public.lessons
  add column if not exists objectives text[] not null default '{}',
  add column if not exists target_phrases text[] not null default '{}';

alter table public.call_logs
  add column if not exists call_channel text,
  add column if not exists call_purpose text,
  add column if not exists lesson_db_id uuid references public.lessons(id) on delete set null;

alter table public.call_logs
  drop constraint if exists call_logs_call_channel_check,
  add constraint call_logs_call_channel_check check (
    call_channel is null or call_channel in ('telephone', 'web', 'mobile')
  ),
  drop constraint if exists call_logs_call_purpose_check,
  add constraint call_logs_call_purpose_check check (
    call_purpose is null or call_purpose in ('guided_lesson', 'conversation_lesson', 'onboarding', 'sales', 'support')
  );

create unique index if not exists call_logs_call_id_unique_when_present
  on public.call_logs (call_id)
  where call_id is not null and call_id <> '';

create index if not exists call_logs_user_created_at_idx
  on public.call_logs (user_id, created_at desc);

alter table public.lesson_attempts
  add column if not exists attempt_status text,
  add column if not exists vocabulary_score numeric(5,2),
  add column if not exists grammar_score numeric(5,2),
  add column if not exists fluency_score numeric(5,2),
  add column if not exists pronunciation_score numeric(5,2),
  add column if not exists final_score numeric(5,2),
  add column if not exists words_per_minute numeric(6,2),
  add column if not exists learner_talk_share numeric(5,2),
  add column if not exists lesson_duration_seconds integer,
  add column if not exists end_reason text;

update public.lesson_attempts
set attempt_status = case pass_status
  when 'passed' then 'passed'
  when 'not_yet_passed' then 'failed'
  when 'incomplete' then 'incomplete'
  else 'pending'
end
where attempt_status is null;

alter table public.lesson_attempts
  alter column attempt_status set default 'pending',
  alter column attempt_status set not null,
  drop constraint if exists lesson_attempts_attempt_status_check,
  add constraint lesson_attempts_attempt_status_check check (
    attempt_status in ('pending', 'passed', 'failed', 'incomplete')
  ),
  drop constraint if exists lesson_attempts_vocabulary_score_check,
  add constraint lesson_attempts_vocabulary_score_check check (
    vocabulary_score is null or (vocabulary_score >= 0 and vocabulary_score <= 100)
  ),
  drop constraint if exists lesson_attempts_grammar_score_check,
  add constraint lesson_attempts_grammar_score_check check (
    grammar_score is null or (grammar_score >= 0 and grammar_score <= 100)
  ),
  drop constraint if exists lesson_attempts_fluency_score_check,
  add constraint lesson_attempts_fluency_score_check check (
    fluency_score is null or (fluency_score >= 0 and fluency_score <= 100)
  ),
  drop constraint if exists lesson_attempts_pronunciation_score_check,
  add constraint lesson_attempts_pronunciation_score_check check (
    pronunciation_score is null or (pronunciation_score >= 0 and pronunciation_score <= 100)
  ),
  drop constraint if exists lesson_attempts_final_score_check,
  add constraint lesson_attempts_final_score_check check (
    final_score is null or (final_score >= 0 and final_score <= 100)
  ),
  drop constraint if exists lesson_attempts_words_per_minute_check,
  add constraint lesson_attempts_words_per_minute_check check (
    words_per_minute is null or words_per_minute >= 0
  ),
  drop constraint if exists lesson_attempts_learner_talk_share_check,
  add constraint lesson_attempts_learner_talk_share_check check (
    learner_talk_share is null or (learner_talk_share >= 0 and learner_talk_share <= 100)
  ),
  drop constraint if exists lesson_attempts_lesson_duration_seconds_check,
  add constraint lesson_attempts_lesson_duration_seconds_check check (
    lesson_duration_seconds is null or lesson_duration_seconds >= 0
  );

create unique index if not exists lesson_attempts_call_id_unique_when_present
  on public.lesson_attempts (call_id)
  where call_id is not null and call_id <> '';

create index if not exists lesson_attempts_user_lesson_time_idx
  on public.lesson_attempts (user_id, lesson_id, attempt_time desc);
