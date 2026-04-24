export type HabitType = "build" | "break";

/** Row from public.habits */
export type Habit = {
  id: string;
  user_id: string;
  name: string;
  type: HabitType;
  start_date: string;
  current_plan_id: string | null;
  context: string | null;
  created_at: string;
};
