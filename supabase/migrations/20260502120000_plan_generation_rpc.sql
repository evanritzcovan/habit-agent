-- Paywall stub (RevenueCat sync in a later phase). Until set true, all users are subject to free-tier AI limits.
alter table public.profiles add column if not exists is_paid_subscriber boolean not null default false;

-- Atomically check monthly limit, increment for free users, and report status.
-- Only service_role can execute: invoked from the generate-habit-plan Edge Function.
create or replace function public.try_consume_ai_generation(
  p_user_id uuid,
  p_month_key text,
  p_free_cap int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_paid boolean := false;
  v_row public.ai_generation_usage%rowtype;
  v_new_used int;
begin
  if p_month_key !~ '^\d{4}-\d{2}$' or p_free_cap < 0 then
    return jsonb_build_object('allowed', false, 'error', 'invalid_arguments');
  end if;

  select coalesce(
    (select p.is_paid_subscriber from public.profiles p where p.id = p_user_id),
    false
  ) into v_is_paid;

  if v_is_paid then
    return jsonb_build_object(
      'allowed', true,
      'is_paid', true,
      'generations_used', null,
      'cap', p_free_cap
    );
  end if;

  insert into public.ai_generation_usage (user_id, month_key, generations_used)
  values (p_user_id, p_month_key, 0)
  on conflict (user_id, month_key) do nothing;

  select * into v_row
  from public.ai_generation_usage
  where user_id = p_user_id and month_key = p_month_key
  for update;

  if v_row.generations_used >= p_free_cap then
    return jsonb_build_object(
      'allowed', false,
      'is_paid', false,
      'error', 'limit_exceeded',
      'generations_used', v_row.generations_used,
      'cap', p_free_cap
    );
  end if;

  v_new_used := v_row.generations_used + 1;
  update public.ai_generation_usage
  set generations_used = v_new_used, updated_at = now()
  where user_id = p_user_id and month_key = p_month_key;

  return jsonb_build_object(
    'allowed', true,
    'is_paid', false,
    'generations_used', v_new_used,
    'cap', p_free_cap
  );
end;
$$;

-- Roll back one generation count after a failed OpenAI call (free tier only; no-op for paid / missing rows).
create or replace function public.release_ai_generation_slot(
  p_user_id uuid,
  p_month_key text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_paid boolean := false;
begin
  if p_month_key !~ '^\d{4}-\d{2}$' then
    return;
  end if;

  select coalesce(
    (select p.is_paid_subscriber from public.profiles p where p.id = p_user_id),
    false
  ) into v_is_paid;
  if v_is_paid then
    return;
  end if;

  update public.ai_generation_usage
  set
    generations_used = greatest(0, generations_used - 1),
    updated_at = now()
  where user_id = p_user_id and month_key = p_month_key;
end;
$$;

revoke all on function public.try_consume_ai_generation(uuid, text, int) from public;
revoke all on function public.release_ai_generation_slot(uuid, text) from public;
grant execute on function public.try_consume_ai_generation(uuid, text, int) to service_role;
grant execute on function public.release_ai_generation_slot(uuid, text) to service_role;
