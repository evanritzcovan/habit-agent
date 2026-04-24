/** Local calendar date as YYYY-MM-DD (not UTC day). */
export function toISODateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODateLocal(s: string): Date {
  const [yy, mm, dd] = s.split("-").map((x) => parseInt(x, 10));
  return new Date(yy, (mm ?? 1) - 1, dd ?? 1, 12, 0, 0, 0);
}
