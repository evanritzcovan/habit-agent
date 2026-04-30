import { FREE_TIER_MONTHLY_AI_GENERATIONS } from "@/lib/product";
import { supabase } from "@/lib/supabase";

export type AiGenerationUiState = {
  cap: number;
  /** Uses same calendar month as the Edge Function (UTC `YYYY-MM`). */
  monthKey: string;
  used: number;
  /** `null` when `isPaid` — unlimited generations for UI purposes. */
  remaining: number | null;
  isPaid: boolean;
};

export function utcMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function getAiGenerationUiState(userId: string): Promise<{
  data: AiGenerationUiState | null;
  error: Error | null;
}> {
  const cap = FREE_TIER_MONTHLY_AI_GENERATIONS;
  const monthKey = utcMonthKey();

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("is_paid_subscriber")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) {
    return { data: null, error: new Error(profileErr.message) };
  }

  const isPaid = profile?.is_paid_subscriber === true;
  if (isPaid) {
    return {
      data: { cap, monthKey, used: 0, remaining: null, isPaid: true },
      error: null,
    };
  }

  const { data: usage, error: usageErr } = await supabase
    .from("ai_generation_usage")
    .select("generations_used")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (usageErr) {
    return { data: null, error: new Error(usageErr.message) };
  }

  const used = usage?.generations_used ?? 0;
  return {
    data: {
      cap,
      monthKey,
      used,
      remaining: Math.max(0, cap - used),
      isPaid: false,
    },
    error: null,
  };
}
