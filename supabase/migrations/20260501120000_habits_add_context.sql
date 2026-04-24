-- Optional free-text context for AI generation (MVP create flow)
alter table public.habits add column if not exists context text;
