import type { Habit } from "@/types/habit";

/**
 * Human-readable streak for list/detail. Full rules land in Phase 11; without an active
 * plan, streak is not yet meaningful, so we show an em dash.
 */
export function habitStreakLabel(habit: Habit): string {
  if (!habit.current_plan_id) {
    return "—";
  }
  return "—";
}
