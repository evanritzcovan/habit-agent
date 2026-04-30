/** Row shape from `public.habit_plans` (JSON column typed as unknown until parsed). */
export type HabitPlanRow = {
  id: string;
  habit_id: string;
  version: number;
  ai_plan: unknown;
  is_active: boolean;
  created_at: string;
};
