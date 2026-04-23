# Supabase: migrations and database

## CLI workflow

1. **Install & login (local dev)**  
   `npm install` includes the `supabase` CLI. Log in: `npx supabase login`  
   *Or* set `SUPABASE_ACCESS_TOKEN` in `.env` from [Access Tokens](https://supabase.com/dashboard/account/tokens) (e.g. for scripts/CI only).

2. **Link the repo to your project** (once per machine, or when you add a new clone)  
   Project ref = subdomain of your URL, e.g. `https://abcdefg.supabase.co` → `abcdefg`.  
   ```bash
   npx supabase link --project-ref YOUR_REF --password YOUR_DATABASE_PASSWORD
   ```  
   The **database password** is under **Settings → Database** in the dashboard (not the publishable API key). You do **not** have to keep it in `.env` after a successful link unless you want it handy for re-linking.

3. **Apply migrations**  
   From the repo root: `supabase db push`

**Optional:** You can remove `SUPABASE_DB_PASSWORD` from `.env` after you’ve run `link` on that machine. Add it back only if you need to `link` again (new computer, re-clone, or `supabase unlink`).

## SQL Editor (no CLI)

Paste **[migrations_merged_for_sql_editor.sql](./migrations_merged_for_sql_editor.sql)** into **SQL → New query** and run.

## Migration files

1. `migrations/20260421000000_initial_schema.sql` — tables, RLS, `on_auth_user_created` → `profiles`
2. `migrations/20260422120000_drop_habits_difficulty.sql` — no-op on fresh DBs

## `habit_plans.ai_plan` JSON

Validated by [schemas/aiPlan.zod.ts](../schemas/aiPlan.zod.ts). Keep Edge Functions in sync when you add them.

## Client

[lib/supabase.ts](../lib/supabase.ts) uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` (publishable key from the API settings page).
