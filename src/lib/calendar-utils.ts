/** Pure date helpers shared by the calendar UI. Client-safe. */

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(iso: string, from = todayIso()): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${iso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type Bucket = "today" | "tomorrow" | "week" | "later" | "past";

export function bucketFor(iso: string, from = todayIso()): Bucket {
  const delta = daysUntil(iso, from);
  if (delta < 0) return "past";
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta <= 7) return "week";
  return "later";
}

export const BUCKET_LABELS: Record<Bucket, string> = {
  past: "Already reported",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "This week",
  later: "Later",
};

export const BUCKET_ORDER: Bucket[] = ["today", "tomorrow", "week", "later", "past"];

export function relativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) return "";
  const then = Date.parse(isoTimestamp);
  if (Number.isNaN(then)) return "";

  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
