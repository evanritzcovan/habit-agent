import { toISODateString } from "@/lib/dates";
import { supabase } from "@/lib/supabase";

export type HabitLogProgressStats = {
  /** Rows with completed === true */
  completedEntries: number;
  /** Distinct local calendar days with at least one completed log */
  distinctCompletedDays: number;
};

/**
 * Completion map for one calendar day (`log_date` YYYY-MM-DD).
 */
export async function fetchStepCompletionForDate(
  habitId: string,
  logDate: string
): Promise<{ data: Map<string, boolean> | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("step_id, completed")
    .eq("habit_id", habitId)
    .eq("log_date", logDate);

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  const map = new Map<string, boolean>();
  for (const row of data ?? []) {
    const r = row as { step_id: string; completed: boolean };
    map.set(r.step_id, r.completed);
  }
  return { data: map, error: null };
}

/**
 * Writes `habit_logs` for a step on a calendar day. Set `isSetupStep` when `step_id` is a
 * `pre_plan_steps[].id` from the active plan (see `isPrePlanStepId` in `@/lib/aiPlanSetup`).
 */
export async function upsertStepLog(
  habitId: string,
  stepId: string,
  logDate: string,
  completed: boolean,
  isSetupStep = false
): Promise<{ error: Error | null }> {
  const { data: existing, error: selErr } = await supabase
    .from("habit_logs")
    .select("id")
    .eq("habit_id", habitId)
    .eq("step_id", stepId)
    .eq("log_date", logDate)
    .maybeSingle();

  if (selErr) {
    return { error: new Error(selErr.message) };
  }

  if (existing && typeof (existing as { id?: unknown }).id === "string") {
    const { error: upErr } = await supabase
      .from("habit_logs")
      .update({ completed, is_setup_step: isSetupStep })
      .eq("id", (existing as { id: string }).id);
    if (upErr) {
      return { error: new Error(upErr.message) };
    }
    return { error: null };
  }

  const { error: insErr } = await supabase.from("habit_logs").insert({
    habit_id: habitId,
    step_id: stepId,
    log_date: logDate,
    completed,
    is_setup_step: isSetupStep,
  });
  if (insErr) {
    return { error: new Error(insErr.message) };
  }
  return { error: null };
}

/** Aggregate stats for Progress tab (client-side from recent rows; fine for MVP scale). */
export async function fetchHabitLogProgressStats(
  habitId: string
): Promise<{ data: HabitLogProgressStats | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("log_date, completed")
    .eq("habit_id", habitId)
    .limit(8000);

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  let completedEntries = 0;
  const daysWithCompletion = new Set<string>();
  for (const row of data ?? []) {
    const r = row as { log_date: string; completed: boolean };
    if (r.completed) {
      completedEntries += 1;
      daysWithCompletion.add(String(r.log_date).slice(0, 10));
    }
  }

  return {
    data: {
      completedEntries,
      distinctCompletedDays: daysWithCompletion.size,
    },
    error: null,
  };
}

export function todayLogDateString(): string {
  return toISODateString(new Date());
}
