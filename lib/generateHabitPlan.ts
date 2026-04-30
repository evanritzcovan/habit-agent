import { FunctionsHttpError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiPlanJson } from "@/schemas/aiPlan.zod";

/**
 * Supabase Edge Function: `generate-habit-plan` (see `supabase/functions/generate-habit-plan/`).
 * Requires a signed-in user; free tier is limited on the server (default 3/month, see function env).
 */
export type GenerateHabitPlanInput = {
  habit_id: string;
  user_input?: string | null;
  adjustment?: {
    level: "too_easy" | "just_right" | "too_hard";
    free_text?: string | null;
  } | null;
  regenerate_note?: string | null;
};

export type GenerateHabitPlanSuccess = {
  plan: AiPlanJson;
  month_key: string;
  generations_used: number | null;
  cap: number;
  is_paid_subscriber: boolean;
};

export type GenerateHabitPlanResult = {
  data: GenerateHabitPlanSuccess | null;
  error: Error | null;
  status?: number;
  limitInfo?: { generations_used: number; cap: number };
};

export async function generateHabitPlan(
  supabase: SupabaseClient,
  input: GenerateHabitPlanInput
): Promise<GenerateHabitPlanResult> {
  const { data, error } = await supabase.functions.invoke<GenerateHabitPlanSuccess>(
    "generate-habit-plan",
    { body: input }
  );

  if (error) {
    if (error instanceof FunctionsHttpError) {
      let body: Record<string, unknown> | null = null;
      try {
        body = (await error.context.json()) as Record<string, unknown>;
      } catch {
        return {
          data: null,
          error: new Error(error.message),
          status: error.context.status,
        };
      }
      if (body?.error === "GENERATION_LIMIT_EXCEEDED") {
        return {
          data: null,
          error: new Error(
            typeof body.message === "string" ? body.message : "Monthly AI generation limit reached."
          ),
          status: 429,
          limitInfo: {
            generations_used: Number(body.generations_used) || 0,
            cap: Number(body.cap) || 3,
          },
        };
      }
      const msg =
        typeof body?.message === "string"
          ? body.message
          : typeof body?.error === "string"
            ? body.error
            : error.message;
      return {
        data: null,
        error: new Error(msg),
        status: error.context.status,
      };
    }
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  if (data == null) {
    return { data: null, error: new Error("No response from generate-habit-plan") };
  }

  if (typeof data === "object" && "plan" in data && (data as GenerateHabitPlanSuccess).plan) {
    return { data: data as GenerateHabitPlanSuccess, error: null };
  }

  return {
    data: null,
    error: new Error("Unexpected response from generate-habit-plan"),
  };
}
