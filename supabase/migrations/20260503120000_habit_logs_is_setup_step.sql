-- Distinguish one-time pre-plan setup completions from recurring step logs (same table, same step_id namespace).
alter table public.habit_logs
  add column if not exists is_setup_step boolean not null default false;

comment on column public.habit_logs.is_setup_step is
  'True when step_id matches a pre_plan_steps id from the active plan JSON; false for recurring steps.';
