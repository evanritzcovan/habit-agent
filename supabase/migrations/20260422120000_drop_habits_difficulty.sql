-- Habit row no longer stores user difficulty; only ai_plan JSON carries plan difficulty.
-- No-op for fresh DBs; removes column if an older migration created it.
alter table public.habits drop column if exists difficulty;
