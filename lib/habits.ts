import { supabase } from "@/lib/supabase";
import type { CreateHabitInput, UpdateHabitInput } from "@/lib/validation/habit";
import type { Habit, HabitType } from "@/types/habit";

function mapHabitRow(row: Record<string, unknown>): Habit {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    type: row.type === "break" ? "break" : "build",
    start_date: String(row.start_date).slice(0, 10),
    current_plan_id: row.current_plan_id ? String(row.current_plan_id) : null,
    context: row.context != null && row.context !== "" ? String(row.context) : null,
    created_at: String(row.created_at),
  };
}

export async function listHabitsForUser(
  userId: string,
  type: HabitType
): Promise<{ data: Habit[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("habits")
    .select("id, user_id, name, type, start_date, current_plan_id, context, created_at")
    .eq("user_id", userId)
    .eq("type", type)
    .order("created_at", { ascending: false });
  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  return { data: (data ?? []).map((r) => mapHabitRow(r as Record<string, unknown>)), error: null };
}

export async function createHabit(
  userId: string,
  input: CreateHabitInput
): Promise<{ data: Habit | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      type: input.type,
      start_date: input.start_date,
      context: input.context ?? null,
    })
    .select("id, user_id, name, type, start_date, current_plan_id, context, created_at")
    .single();
  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  if (!data) {
    return { data: null, error: new Error("No habit returned") };
  }
  return { data: mapHabitRow(data as unknown as Record<string, unknown>), error: null };
}

export async function getHabitById(
  userId: string,
  habitId: string
): Promise<{ data: Habit | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("habits")
    .select("id, user_id, name, type, start_date, current_plan_id, context, created_at")
    .eq("id", habitId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  if (!data) {
    return { data: null, error: null };
  }
  return { data: mapHabitRow(data as unknown as Record<string, unknown>), error: null };
}

export async function updateHabit(
  userId: string,
  habitId: string,
  input: UpdateHabitInput
): Promise<{ data: Habit | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("habits")
    .update({
      name: input.name.trim(),
      start_date: input.start_date,
    })
    .eq("id", habitId)
    .eq("user_id", userId)
    .select("id, user_id, name, type, start_date, current_plan_id, context, created_at")
    .single();
  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  if (!data) {
    return { data: null, error: new Error("Habit not found or not updated") };
  }
  return { data: mapHabitRow(data as unknown as Record<string, unknown>), error: null };
}

export async function deleteHabit(
  userId: string,
  habitId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", habitId)
    .eq("user_id", userId);
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}
