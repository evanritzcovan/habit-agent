import type { AiPlanJson } from "@/schemas/aiPlan.zod";
import { supabase } from "@/lib/supabase";
import type { HabitPlanRow } from "@/types/habitPlan";

function mapPlanRow(row: Record<string, unknown>): HabitPlanRow {
  return {
    id: String(row.id),
    habit_id: String(row.habit_id),
    version: Number(row.version),
    ai_plan: row.ai_plan,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

export async function fetchPlanVersionsForHabit(
  userId: string,
  habitId: string
): Promise<{ data: HabitPlanRow[] | null; error: Error | null }> {
  const { data: habitCheck, error: hErr } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", userId)
    .maybeSingle();

  if (hErr) {
    return { data: null, error: new Error(hErr.message) };
  }
  if (!habitCheck) {
    return { data: null, error: new Error("Habit not found") };
  }

  const { data, error } = await supabase
    .from("habit_plans")
    .select("id, habit_id, version, ai_plan, is_active, created_at")
    .eq("habit_id", habitId)
    .order("version", { ascending: false });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  return {
    data: (data ?? []).map((r) => mapPlanRow(r as unknown as Record<string, unknown>)),
    error: null,
  };
}

export async function fetchActivePlanRowForHabit(
  userId: string,
  habitId: string
): Promise<{ data: HabitPlanRow | null; error: Error | null }> {
  const gate = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", userId)
    .maybeSingle();
  if (gate.error) {
    return { data: null, error: new Error(gate.error.message) };
  }
  if (!gate.data) {
    return { data: null, error: new Error("Habit not found") };
  }

  const { data, error } = await supabase
    .from("habit_plans")
    .select("id, habit_id, version, ai_plan, is_active, created_at")
    .eq("habit_id", habitId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  if (!data) {
    return { data: null, error: null };
  }
  return { data: mapPlanRow(data as unknown as Record<string, unknown>), error: null };
}

/**
 * Insert a new plan version, mark it active, deactivate others for this habit, set `habits.current_plan_id`.
 */
export async function saveActiveHabitPlan(
  userId: string,
  habitId: string,
  aiPlan: AiPlanJson
): Promise<{ data: { planId: string; version: number } | null; error: Error | null }> {
  const { data: habitRow, error: habitErr } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", userId)
    .maybeSingle();

  if (habitErr) {
    return { data: null, error: new Error(habitErr.message) };
  }
  if (!habitRow) {
    return { data: null, error: new Error("Habit not found") };
  }

  const { data: maxList } = await supabase
    .from("habit_plans")
    .select("version")
    .eq("habit_id", habitId)
    .order("version", { ascending: false })
    .limit(1);

  const maxVersion = maxList?.[0]?.version;
  const nextVersion = typeof maxVersion === "number" ? maxVersion + 1 : 1;

  const { data: inserted, error: insertErr } = await supabase
    .from("habit_plans")
    .insert({
      habit_id: habitId,
      version: nextVersion,
      ai_plan: aiPlan,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return {
      data: null,
      error: new Error(insertErr?.message ?? "Could not save plan"),
    };
  }

  const planId = String((inserted as { id: string }).id);

  const { error: deactivateErr } = await supabase
    .from("habit_plans")
    .update({ is_active: false })
    .eq("habit_id", habitId)
    .neq("id", planId);

  if (deactivateErr) {
    return { data: null, error: new Error(deactivateErr.message) };
  }

  const { error: habitUpdateErr } = await supabase
    .from("habits")
    .update({ current_plan_id: planId })
    .eq("id", habitId)
    .eq("user_id", userId);

  if (habitUpdateErr) {
    return { data: null, error: new Error(habitUpdateErr.message) };
  }

  return { data: { planId, version: nextVersion }, error: null };
}
