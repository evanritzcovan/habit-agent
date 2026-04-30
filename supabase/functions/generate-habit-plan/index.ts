/**
 * Phase 6: generate or steer a habit plan via OpenAI, validate with shared Zod, enforce free-tier monthly cap.
 *
 * Secrets (Supabase Dashboard → Edge Functions → Secrets):
 *   OPENAI_API_KEY        — required
 *   OPENAI_MODEL          — optional, default gpt-4o-mini
 *   FREE_TIER_MONTHLY_AI_GENERATIONS — optional, default 3 (align with config/product.json)
 *
 * Same transaction pattern: reserve slot (RPC) → OpenAI → on hard failure, release slot (RPC).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// JS client for Edge (Deno `npm:` specifier — bundled remotely; not read from repo node_modules).
// Use major line `2` so patch/minor updates resolve without editing this file; align with app dependency `@supabase/supabase-js@^2`.
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseAiPlanForHabit } from "../_shared/aiPlan.zod.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type HabitType = "build" | "break";
type AdjustmentLevel = "too_easy" | "just_right" | "too_hard";

type RequestBody = {
  habit_id: string;
  /** Extra notes for the model (on top of stored habit context). */
  user_input?: string | null;
  /** After a plan exists: steer intensity. */
  adjustment?: {
    level: AdjustmentLevel;
    free_text?: string | null;
  } | null;
  /** Optional free text for open regenerate (no adjustment object). */
  regenerate_note?: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function currentMonthKeyUtc(): string {
  return new Date().toISOString().slice(0, 7);
}

function parseRequestBody(raw: unknown): RequestBody {
  if (!raw || typeof raw !== "object") throw new Error("Invalid JSON body");
  const o = raw as Record<string, unknown>;
  if (typeof o.habit_id !== "string" || o.habit_id.length < 10) {
    throw new Error("habit_id is required");
  }
  return {
    habit_id: o.habit_id,
    user_input: o.user_input == null ? undefined : String(o.user_input),
    adjustment: o.adjustment == null || o.adjustment === undefined
      ? null
      : (() => {
        const a = o.adjustment as Record<string, unknown>;
        const level = a.level;
        if (level !== "too_easy" && level !== "just_right" && level !== "too_hard") {
          throw new Error("adjustment.level must be too_easy, just_right, or too_hard");
        }
        return {
          level,
          free_text: a.free_text == null ? undefined : String(a.free_text),
        };
      })(),
    regenerate_note: o.regenerate_note == null ? undefined : String(o.regenerate_note),
  };
}

function buildSystemPrompt(habitType: HabitType): string {
  const breakAddictionNote =
    habitType === "break"
      ? `- Breaking nicotine/substance/process addictions (e.g. vaping, smoking, alcohol, compulsive behaviors) should almost always use difficulty "hard" and estimated_duration_days in the 60–120 range unless the user context clearly indicates a trivial case.\n`
      : "";

  return `You are a habit coach. You MUST return a single JSON object (no markdown, no commentary) with this exact shape:
{
  "summary": string — ONE sentence only (overview). No second sentence. Aim under 220 characters.
  "difficulty": "easy" | "medium" | "hard",
  "estimated_duration_days": integer 1-365,
  "triggers": string[] (0-20 items, each string max 500 chars),
  "pre_plan_steps": array of 0-4 objects (setup checklist BEFORE recurring steps appear on "Today"):
    "id": string (UUID v4; MUST be unique across ALL ids in pre_plan_steps AND steps — no duplicates),
    "title": string (1-500 chars),
    "description": string (ONE sentence only) — imperative what to do, plus why this blocks tracked daily/weekly steps until done.
  "setup_estimated_minutes": integer 5-120 — REQUIRED if pre_plan_steps has any items (total minutes for the full setup checklist); MUST be OMITTED if pre_plan_steps is empty [],
  "steps": array of 1-7 objects (recurring plan — each with):
    "id": string (a valid UUID v4 for each step, unique),
    "title": string (1-500 chars),
    "description": string (required, non-empty after trim; very short is OK) — one line expanding what to do (never omit; use a brief echo of the title if nothing else),
    "frequency": "daily" | "weekly" | "monthly",
    "weekdays": [0-6] only if frequency is "weekly" — integers where 0=Sunday, 1=Monday, …, 6=Saturday; at least one unique weekday; max 7 entries
}

Pre-plan (setup) rules:
- Include pre_plan_steps ONLY when real preparation must happen before the recurring checklist can be honored (environment, safety, tools, legal/practical access). If nothing blocks tracking, use "pre_plan_steps": [] and omit setup_estimated_minutes.
- Be CONSISTENT: apply the same bar on first-time plans and regenerations—do not reserve setup only for “second tries.”
- CRITICAL: "steps" must ALWAYS contain at least one recurring checklist item — NEVER output "steps": []. Setup belongs in pre_plan_steps; recurring practice belongs in steps. If pre_plan_steps is non-empty, you STILL must include at least one separate item in "steps" for ongoing behavior after setup (e.g. weekly practice session).
- When User context (or notes) says the user lacks something essential—equipment (e.g. no clubs), legal ability (e.g. no license), vehicle/access, venue, money for minimum gear, lessons before safe practice—put the one-time path to fix that (research, buy/rent, book lesson, start permit process, arrange supervised access) in pre_plan_steps. Those are setup, not substitute recurring habits.
- Do NOT fold prerequisite acquisition into recurring steps as if it were the same as ongoing practice. Example: “buy clubs” / “schedule first lesson” belongs in pre_plan_steps; “hit bucket of balls at the range twice weekly” belongs in steps after clubs exist. Example: if they cannot legally drive yet, permit/lesson milestones go in pre_plan_steps; recurring steps are practice sessions only once driving is possible under supervision or law.
- Recurring "steps" are ongoing behaviors the user repeats on a schedule once they can actually perform the habit. If context implies they cannot yet do the core habit at all until setup completes, do not pretend weekly/daily steps are enough without pre_plan_steps.
- Cap at 4 items; prefer 2-3. Each item must be justified as blocking — omit filler.
- Order items in a sensible sequence when steps depend on each other (e.g. permit research → enroll lessons → supervised practice access).
- Descriptions must stay one sentence each (action + blocking reason).
- Regenerated plans replace prior versions — treat setup as fresh for the new JSON (client will reset completion).

Summary:
- The summary must be a single sentence. Never use a paragraph or bullet-style list in "summary".

Difficulty — choose the label that matches real-world effort (do NOT default to "medium"):
- EASY: low resistance; minimal lifestyle disruption; no addiction component. Examples: drink more water, stretch daily.
- MEDIUM: needs consistency and real behavior change; some inertia or resistance. Examples: exercise regularly, reduce screen time.
- HARD: addictive or deeply ingrained habits; strong emotional/environmental/social triggers; needs replacement behaviors and coping skills. Examples: quit nicotine, quit vaping, reduce compulsive use of substances or behaviors.
Rules:
- Breaking addictive habits should almost always be HARD.
- Do not default to "medium". Pick easy, medium, or hard deliberately.

Estimated duration (days) — must align with the difficulty you chose (do NOT default to 30):
- EASY: typically 14–30 days (simple adoption or small behavior tweak).
- MEDIUM: typically 30–60 days (sustained consistency and moderate change).
- HARD: typically 60–120 days (rewiring, triggers, relapse risk).
Rules:
- Do not default to 30 days.
- If difficulty and duration disagree, change duration until they match the guidelines.
- Do not reuse the same duration for every plan unless the habits truly need the same timeline.

${breakAddictionNote}
Steps — each step must work as a checklist item the user can complete and track:
- Every recurring step MUST include a non-empty "description" (can be very short). Title may be short; description adds the concrete behavior or repeats the title in one phrase if the step is trivial.
- Each step must start with an imperative verb (e.g. Log, Write, Replace, Avoid, Chew, Walk, Message, Set, Remove).
- Describe specific actions the user can physically do or complete in the moment — measurable or observable when possible.
- Avoid vague phrasing: no "be mindful", "try to", "consider", "find ways", "identify" without a concrete method, or generic advice.

Bad examples (too vague for checklists):
- "Identify triggers" / "Find healthier alternatives" / "Assess progress"

Better examples (imperative, checkable):
- "Log each craving in your phone notes with time and place as it happens"
- "Chew nicotine gum or drink a full glass of water before doing anything else when an urge hits"
- "Write yes or no in your daily note: did you vape today?"

Schema rules:
- For habit type "break", "triggers" must have at least one item (cues/environments/social situations).
- For habit type "build", triggers may be an empty array.
- At most 7 entries in "steps" (minimum 1 — never zero). At most 4 in "pre_plan_steps".
- Weekly steps MUST include "weekdays". Daily and monthly steps must NOT include weekdays.
- Use "monthly" when the action naturally happens about once per month.
- Never reuse a UUID across pre_plan_steps and steps.`;
}

function buildValidationRepairFeedback(zodErr: string, habitType: HabitType): string {
  const lower = zodErr.toLowerCase();
  const parts = [`Previous JSON failed validation:\n${zodErr}`];
  const emptyStepsHint =
    lower.includes("steps") ||
    (lower.includes("array") && (lower.includes("least") || lower.includes("minimum") || lower.includes("too small"))) ||
    lower.includes("at least 1 element");
  if (emptyStepsHint) {
    parts.push(
      `Fix: "steps" must be a non-empty array with at least one recurring item (daily/weekly/monthly). Never []. If you listed setup in pre_plan_steps, also add separate ongoing steps here.`,
    );
  }
  if (habitType === "break" && lower.includes("trigger")) {
    parts.push(`Fix: "triggers" must be a non-empty array of strings for break habits.`);
  }
  if (lower.includes("weekday")) {
    parts.push(`Fix: each weekly step needs "weekdays" with at least one day (0–6).`);
  }
  if (lower.includes("setup_estimated") || lower.includes("pre_plan_steps")) {
    parts.push(
      `Fix: if pre_plan_steps has items, include setup_estimated_minutes (5–120). If pre_plan_steps is [], omit setup_estimated_minutes.`,
    );
  }
  parts.push(`Return a complete valid JSON object that satisfies every rule.`);
  return parts.join("\n\n");
}

function buildUserPrompt(params: {
  name: string;
  habitType: HabitType;
  startDate: string;
  context: string | null;
  userInput?: string | null;
  adjustment: RequestBody["adjustment"];
  regenerateNote?: string | null;
  /** True when the habit already had an active plan (regenerate / replace / adjust). */
  isReplacementPlan: boolean;
}): string {
  const lines: string[] = [
    `Habit type: ${params.habitType} (${params.habitType === "build" ? "building a new behavior" : "breaking an unwanted pattern"}).`,
    `Habit name: ${params.name}.`,
    `Start date: ${params.startDate}.`,
  ];
  if (params.context && params.context.trim().length > 0) {
    lines.push(`User context: ${params.context.trim()}`);
    lines.push(
      "If this context states missing gear, license/permission, vehicle/access, or other prerequisites to actually do the habit, use pre_plan_steps for one-time resolution tasks. Do not only embed those prerequisites as recurring checklist steps.",
    );
  }
  if (params.userInput && params.userInput.trim().length > 0) {
    lines.push(`Additional user notes: ${params.userInput.trim()}`);
  }
  if (params.regenerateNote && params.regenerateNote.trim().length > 0) {
    lines.push(`User request (regenerate): ${params.regenerateNote.trim()}`);
  }
  if (params.adjustment) {
    const map: Record<AdjustmentLevel, string> = {
      too_easy: "The previous plan felt too easy; increase challenge appropriately while staying safe and realistic.",
      just_right: "The previous plan felt about right; refine slightly if needed but keep a similar difficulty.",
      too_hard: "The previous plan felt too hard; make the plan more achievable and reduce overload.",
    };
    lines.push(`User adjustment: ${map[params.adjustment.level]}`);
    if (params.adjustment.free_text?.trim().length) {
      lines.push(`User adjustment detail: ${params.adjustment.free_text.trim()}`);
    }
  }

  if (params.isReplacementPlan) {
    lines.push(
      "This plan replaces an existing active plan. Use NEW UUIDs for every pre_plan step and recurring step (fresh setup checklist). Include pre_plan_steps only when setup truly gates recurring tracking; otherwise []. If non-empty, include setup_estimated_minutes. Choose difficulty and estimated_duration_days using the system guidelines—do not default to medium or 30 days. Keep summary to one sentence.",
    );
  } else {
    lines.push(
      "This is an initial plan. Choose difficulty and estimated_duration_days using the system guidelines—do not default to medium or 30 days. Align duration with difficulty. Keep summary to one sentence. Emit pre_plan_steps only when setup truly gates recurring tracking; otherwise []. If non-empty, include setup_estimated_minutes.",
    );
  }
  lines.push("Return ONLY the JSON object, nothing else.");
  return lines.join("\n");
}

async function callOpenAi(params: { system: string; user: string; feedback?: string }): Promise<unknown> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  // Default model: fast / cost-effective; override via secret for production.
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
  const userContent = params.feedback
    ? `${params.user}\n\n---\nYour previous output failed validation. Fix the JSON. Issues:\n${params.feedback}\n\nReturn a complete valid JSON object.`
    : params.user;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${t.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || !raw.length) {
    throw new Error("OpenAI returned empty content");
  }
  return JSON.parse(raw) as unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let body: RequestBody;
  try {
    body = parseRequestBody(await req.json());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid body";
    return jsonResponse({ error: "bad_request", message: msg }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: habit, error: habitErr } = await admin
    .from("habits")
    .select("id, user_id, name, type, start_date, context, current_plan_id")
    .eq("id", body.habit_id)
    .maybeSingle();

  if (habitErr) {
    console.error(habitErr);
    return jsonResponse({ error: "habit_load_failed" }, 500);
  }
  if (!habit) {
    return jsonResponse({ error: "not_found" }, 404);
  }
  if (habit.user_id !== user.id) {
    return jsonResponse({ error: "forbidden" }, 403);
  }
  if (habit.type !== "build" && habit.type !== "break") {
    return jsonResponse({ error: "invalid_habit_type" }, 400);
  }

  const freeCap = Number(
    Deno.env.get("FREE_TIER_MONTHLY_AI_GENERATIONS") ?? "3",
  );
  if (Number.isNaN(freeCap) || freeCap < 0) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const monthKey = currentMonthKeyUtc();
  const { data: consumeRaw, error: consumeErr } = await admin.rpc(
    "try_consume_ai_generation",
    {
      p_user_id: user.id,
      p_month_key: monthKey,
      p_free_cap: freeCap,
    },
  );

  if (consumeErr) {
    console.error(consumeErr);
    return jsonResponse({ error: "usage_check_failed" }, 500);
  }

  const consume = consumeRaw as {
    allowed?: boolean;
    error?: string;
    is_paid?: boolean;
    generations_used?: number | null;
    cap?: number;
  } | null;

  if (!consume?.allowed) {
    return jsonResponse(
      {
        error: "GENERATION_LIMIT_EXCEEDED",
        message: "Monthly AI generation limit reached. Upgrade to continue.",
        generations_used: consume?.generations_used,
        cap: consume?.cap ?? freeCap,
      },
      429,
    );
  }

  const system = buildSystemPrompt(habit.type as HabitType);
  const userPrompt = buildUserPrompt({
    name: habit.name,
    habitType: habit.type as HabitType,
    startDate: habit.start_date,
    context: habit.context,
    userInput: body.user_input,
    adjustment: body.adjustment,
    regenerateNote: body.regenerate_note,
    isReplacementPlan: Boolean(habit.current_plan_id),
  });

  let zodErr: string | null = null;
  let planJson: ReturnType<typeof parseAiPlanForHabit> | null = null;

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await callOpenAi({
        system,
        user: userPrompt,
        feedback:
          attempt === 0 ? undefined : buildValidationRepairFeedback(zodErr ?? "Invalid plan JSON", habit.type as HabitType),
      });
      try {
        planJson = parseAiPlanForHabit(raw, habit.type as HabitType);
        break;
      } catch (e) {
        zodErr = e instanceof Error ? e.message : String(e);
        if (attempt === 2) {
          throw e;
        }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("openai/parse", msg);
    const { error: relErr } = await admin.rpc("release_ai_generation_slot", {
      p_user_id: user.id,
      p_month_key: monthKey,
    });
    if (relErr) {
      console.error("release slot failed", relErr);
    }
    return jsonResponse(
      { error: "plan_generation_failed", message: msg.slice(0, 2000) },
      502,
    );
  }

  if (!planJson) {
    const { error: relErr } = await admin.rpc("release_ai_generation_slot", {
      p_user_id: user.id,
      p_month_key: monthKey,
    });
    if (relErr) {
      console.error("release slot failed", relErr);
    }
    return jsonResponse({ error: "plan_generation_failed", message: "empty_result" }, 502);
  }

  return jsonResponse({
    plan: planJson,
    month_key: monthKey,
    generations_used: consume?.generations_used,
    cap: consume?.cap ?? freeCap,
    is_paid_subscriber: Boolean(consume?.is_paid),
  });
});
