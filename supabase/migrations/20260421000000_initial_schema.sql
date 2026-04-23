-- Habit Agent: initial schema (habits, plans, logs, usage, profiles)
-- Apply with Supabase CLI: supabase db push / migration workflow

-- ---------------------------------------------------------------------------
-- profiles (optional: display name, mirrors auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('build', 'break')),
  start_date date not null,
  current_plan_id uuid,
  created_at timestamptz not null default now(),
  constraint habits_name_len check (char_length(trim(name)) > 0)
);

create index if not exists habits_user_id_idx on public.habits (user_id);
create index if not exists habits_user_type_idx on public.habits (user_id, type);

-- FK from habits.current_plan_id -> habit_plans added after habit_plans exists

-- ---------------------------------------------------------------------------
-- habit_plans (versioned JSON plan per habit)
-- ---------------------------------------------------------------------------
create table if not exists public.habit_plans (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  version int not null,
  ai_plan jsonb not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (habit_id, version)
);

create index if not exists habit_plans_habit_id_idx on public.habit_plans (habit_id);
create index if not exists habit_plans_habit_active_idx on public.habit_plans (habit_id) where is_active = true;

alter table public.habits
  add constraint habits_current_plan_fk
  foreign key (current_plan_id) references public.habit_plans (id) on delete set null;

-- ---------------------------------------------------------------------------
-- habit_logs (per step per calendar day)
-- ---------------------------------------------------------------------------
create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  step_id text not null,
  log_date date not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (habit_id, step_id, log_date)
);

create index if not exists habit_logs_habit_date_idx on public.habit_logs (habit_id, log_date);
create index if not exists habit_logs_step_idx on public.habit_logs (habit_id, step_id);

-- ---------------------------------------------------------------------------
-- ai_generation_usage — global pool per user per month (month_key: YYYY-MM)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_generation_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  generations_used int not null default 0 check (generations_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

create index if not exists ai_generation_usage_user_idx on public.ai_generation_usage (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.habit_plans enable row level security;
alter table public.habit_logs enable row level security;
alter table public.ai_generation_usage enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- habits
create policy "habits_select_own" on public.habits
  for select using (auth.uid() = user_id);
create policy "habits_insert_own" on public.habits
  for insert with check (auth.uid() = user_id);
create policy "habits_update_own" on public.habits
  for update using (auth.uid() = user_id);
create policy "habits_delete_own" on public.habits
  for delete using (auth.uid() = user_id);

-- habit_plans: user owns parent habit
create policy "habit_plans_select" on public.habit_plans
  for select using (
    exists (select 1 from public.habits h where h.id = habit_plans.habit_id and h.user_id = auth.uid())
  );
create policy "habit_plans_insert" on public.habit_plans
  for insert with check (
    exists (select 1 from public.habits h where h.id = habit_plans.habit_id and h.user_id = auth.uid())
  );
create policy "habit_plans_update" on public.habit_plans
  for update using (
    exists (select 1 from public.habits h where h.id = habit_plans.habit_id and h.user_id = auth.uid())
  );
create policy "habit_plans_delete" on public.habit_plans
  for delete using (
    exists (select 1 from public.habits h where h.id = habit_plans.habit_id and h.user_id = auth.uid())
  );

-- habit_logs: user owns parent habit
create policy "habit_logs_select" on public.habit_logs
  for select using (
    exists (select 1 from public.habits h where h.id = habit_logs.habit_id and h.user_id = auth.uid())
  );
create policy "habit_logs_insert" on public.habit_logs
  for insert with check (
    exists (select 1 from public.habits h where h.id = habit_logs.habit_id and h.user_id = auth.uid())
  );
create policy "habit_logs_update" on public.habit_logs
  for update using (
    exists (select 1 from public.habits h where h.id = habit_logs.habit_id and h.user_id = auth.uid())
  );
create policy "habit_logs_delete" on public.habit_logs
  for delete using (
    exists (select 1 from public.habits h where h.id = habit_logs.habit_id and h.user_id = auth.uid())
  );

-- ai_generation_usage: own rows only
create policy "ai_usage_select" on public.ai_generation_usage
  for select using (auth.uid() = user_id);
create policy "ai_usage_insert" on public.ai_generation_usage
  for insert with check (auth.uid() = user_id);
create policy "ai_usage_update" on public.ai_generation_usage
  for update using (auth.uid() = user_id);
create policy "ai_usage_delete" on public.ai_generation_usage
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- New user: optional trigger to create profile (can be done in app instead)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
