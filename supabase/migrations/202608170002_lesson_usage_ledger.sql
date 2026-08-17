-- Charge lesson minutes only after the lesson outcome is known.
-- This preserves the existing ledger while making the charging rule explicit.

alter table public.call_usage_ledger
  add column if not exists call_purpose text,
  add column if not exists attempt_status text,
  add column if not exists planned_duration_seconds integer,
  add column if not exists charge_reason text;

alter table public.call_usage_ledger
  drop constraint if exists call_usage_ledger_attempt_status_check,
  add constraint call_usage_ledger_attempt_status_check check (
    attempt_status is null or attempt_status in ('passed', 'failed', 'incomplete')
  ),
  drop constraint if exists call_usage_ledger_planned_duration_seconds_check,
  add constraint call_usage_ledger_planned_duration_seconds_check check (
    planned_duration_seconds is null or planned_duration_seconds > 0
  );

create or replace function public.apply_lesson_usage(
  p_user_id uuid,
  p_call_id text,
  p_duration_ms bigint,
  p_planned_duration_seconds integer,
  p_attempt_status text
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_minutes integer;
  v_charge boolean;
  v_charge_reason text;
  v_inserted boolean := false;
  v_existing record;
  v_monthly integer;
  v_total integer;
begin
  if p_user_id is null then raise exception 'p_user_id is required'; end if;
  if p_call_id is null or btrim(p_call_id) = '' then raise exception 'p_call_id is required'; end if;
  if p_duration_ms is null or p_duration_ms < 0 then raise exception 'p_duration_ms must be zero or greater'; end if;
  if p_planned_duration_seconds is null or p_planned_duration_seconds <= 0 then raise exception 'p_planned_duration_seconds must be greater than zero'; end if;
  if p_attempt_status not in ('passed', 'failed', 'incomplete') then raise exception 'p_attempt_status must be passed, failed, or incomplete'; end if;

  v_minutes := ceil(p_duration_ms / 60000.0)::integer;
  v_charge := p_attempt_status in ('passed', 'failed')
    or (p_attempt_status = 'incomplete' and p_duration_ms >= (p_planned_duration_seconds * 1000 * 0.33));
  v_charge_reason := case
    when p_attempt_status = 'passed' then 'passed_lesson'
    when p_attempt_status = 'failed' then 'failed_lesson'
    when v_charge then 'incomplete_at_or_over_33_percent'
    else 'incomplete_under_33_percent'
  end;

  insert into public.call_usage_ledger(
    call_id, user_id, duration_ms, minutes_charged, call_purpose,
    attempt_status, planned_duration_seconds, charge_reason
  ) values (
    p_call_id, p_user_id, p_duration_ms,
    case when v_charge then v_minutes else 0 end,
    'guided_lesson', p_attempt_status, p_planned_duration_seconds, v_charge_reason
  )
  on conflict (call_id) do nothing
  returning true into v_inserted;

  if coalesce(v_inserted, false) then
    update public.users
    set used_time_this_month = coalesce(used_time_this_month, 0) + case when v_charge then v_minutes else 0 end,
        total_time_used = coalesce(total_time_used, 0) + case when v_charge then v_minutes else 0 end
    where id = p_user_id
    returning used_time_this_month, total_time_used into v_monthly, v_total;

    if not found then raise exception 'user not found'; end if;

    return jsonb_build_object(
      'applied', true,
      'charged', v_charge,
      'minutes_charged', case when v_charge then v_minutes else 0 end,
      'charge_reason', v_charge_reason,
      'used_time_this_month', v_monthly,
      'total_time_used', v_total
    );
  end if;

  select user_id, minutes_charged, charge_reason into v_existing
  from public.call_usage_ledger where call_id = p_call_id;
  if v_existing.user_id is distinct from p_user_id then raise exception 'call_id already belongs to another user'; end if;

  select used_time_this_month, total_time_used into v_monthly, v_total
  from public.users where id = p_user_id;

  return jsonb_build_object(
    'applied', false,
    'charged', coalesce(v_existing.minutes_charged, 0) > 0,
    'minutes_charged', coalesce(v_existing.minutes_charged, 0),
    'charge_reason', v_existing.charge_reason,
    'used_time_this_month', v_monthly,
    'total_time_used', v_total
  );
end;
$$;

revoke all on function public.apply_lesson_usage(uuid, text, bigint, integer, text) from public, anon, authenticated;
grant execute on function public.apply_lesson_usage(uuid, text, bigint, integer, text) to service_role;
