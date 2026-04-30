import type { AiGenerationUiState } from "@/lib/aiGeneration";
import type { HabitLogProgressStats } from "@/lib/habitLogs";
import type { Habit } from "@/types/habit";
import type { HabitPlanRow } from "@/types/habitPlan";

export type HabitDetailCacheEntry = {
  habit: Habit;
  planVersions: HabitPlanRow[];
  genUi: AiGenerationUiState | null;
  logStats: HabitLogProgressStats | null;
  stepDoneToday: Record<string, boolean>;
};

const store = new Map<string, HabitDetailCacheEntry>();

function key(userId: string, habitId: string): string {
  return `${userId}:${habitId}`;
}

export function getHabitDetailCache(userId: string, habitId: string): HabitDetailCacheEntry | undefined {
  return store.get(key(userId, habitId));
}

export function setHabitDetailCache(userId: string, habitId: string, entry: HabitDetailCacheEntry): void {
  store.set(key(userId, habitId), entry);
}

export function invalidateHabitDetailCache(userId: string, habitId: string): void {
  store.delete(key(userId, habitId));
}

export function habitDetailCacheEntryFromState(
  habit: Habit,
  planVersions: HabitPlanRow[],
  genUi: AiGenerationUiState | null,
  logStats: HabitLogProgressStats | null,
  stepDoneToday: Map<string, boolean>
): HabitDetailCacheEntry {
  return {
    habit,
    planVersions,
    genUi,
    logStats,
    stepDoneToday: Object.fromEntries(stepDoneToday.entries()),
  };
}
