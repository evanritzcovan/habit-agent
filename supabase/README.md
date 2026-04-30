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
3. `migrations/20260501120000_habits_add_context.sql` — optional `habits.context` for AI
4. `migrations/20260502120000_plan_generation_rpc.sql` — `profiles.is_paid_subscriber` (stub for billing), RPCs `try_consume_ai_generation` / `release_ai_generation_slot` (service_role only; used by the plan Edge Function)

## `habit_plans.ai_plan` JSON

Validated by [schemas/aiPlan.zod.ts](../schemas/aiPlan.zod.ts). The Edge Function duplicates this contract under `supabase/functions/_shared/aiPlan.zod.ts` (keep both in sync).

## Edge Function: `generate-habit-plan` (Phase 6)

Generates a validated plan via OpenAI, enforces the **free-tier monthly generation cap** (default **3**; align with [config/product.json](../config/product.json) by setting the same value in function secrets), and returns JSON matching the Zod contract.

**Secrets** (Supabase Dashboard → **Edge Functions** → **Secrets**, or CLI):

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | Required. OpenAI API key. |
| `OPENAI_MODEL` | Optional. Default `gpt-4o-mini`. |
| `FREE_TIER_MONTHLY_AI_GENERATIONS` | Optional. Default `3`. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided to the function at runtime; do not commit the service key.

**Deploy (after `supabase link`):**

```bash
npx supabase functions deploy generate-habit-plan
```

**Local serve** (with local stack and secrets): see [Supabase Edge Functions](https://supabase.com/docs/guides/functions).

**Invoke (authenticated):** the app can call [lib/generateHabitPlan.ts](../lib/generateHabitPlan.ts) (`generateHabitPlan(supabase, { habit_id })`) or any HTTP client with a user JWT: `POST /functions/v1/generate-habit-plan` and `Authorization: Bearer <access_token>`.

## Client

[lib/supabase.ts](../lib/supabase.ts) uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` (publishable key from the API settings page). Plan generation uses [lib/generateHabitPlan.ts](../lib/generateHabitPlan.ts) once the function is deployed.
