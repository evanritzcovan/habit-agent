const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** `days` uses 0 = Sunday … 6 = Saturday (`Date.getDay()`). */
export function formatWeekdayList(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  return sorted.map((d) => SHORT[d] ?? String(d)).join(", ");
}
