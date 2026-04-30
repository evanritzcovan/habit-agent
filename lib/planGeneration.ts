import { generateHabitPlan, type GenerateHabitPlanInput } from "@/lib/generateHabitPlan";
import { getHabitById } from "@/lib/habits";
import { saveActiveHabitPlan } from "@/lib/habitPlans";
import { supabase } from "@/lib/supabase";
import type { Habit } from "@/types/habit";

export type GenerateAndAttachPlanOptions = Omit<GenerateHabitPlanInput, "habit_id">;

export type GenerateAndAttachPlanResult = {
  habit: Habit | null;
  generationMeta: {
    generations_used: number | null;
    cap: number;
    is_paid_subscriber: boolean;
    month_key: string;
  } | null;
  error: Error | null;
  limitInfo?: { generations_used: number; cap: number };
};

/**
 * Calls the Edge Function, persists `habit_plans`, and updates `habits.current_plan_id`.
 */
export async function generateAndAttachPlan(
  userId: string,
  habitId: string,
  opts?: GenerateAndAttachPlanOptions
): Promise<GenerateAndAttachPlanResult> {
  const gen = await generateHabitPlan(supabase, {
    habit_id: habitId,
    ...(opts ?? {}),
  });

  if (gen.error || !gen.data) {
    return {
      habit: null,
      generationMeta: null,
      error: gen.error ?? new Error("Generation failed"),
      limitInfo: gen.limitInfo,
    };
  }

  const save = await saveActiveHabitPlan(userId, habitId, gen.data.plan);
  if (save.error || !save.data) {
    return {
      habit: null,
      generationMeta: null,
      error: save.error ?? new Error("Could not save plan"),
    };
  }

  const refreshed = await getHabitById(userId, habitId);
  return {
    habit: refreshed.data,
    generationMeta: {
      generations_used: gen.data.generations_used,
      cap: gen.data.cap,
      is_paid_subscriber: gen.data.is_paid_subscriber,
      month_key: gen.data.month_key,
    },
    error: null,
  };
}
