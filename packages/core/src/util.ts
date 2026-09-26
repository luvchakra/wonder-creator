export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < -45) {
    // A time still to come (an expiry, a schedule).
    const ahead = -diff;
    if (ahead < 3600) return `in ${Math.max(1, Math.round(ahead / 60))} min`;
    if (ahead < 86400) return `in ${Math.round(ahead / 3600)} hour${Math.round(ahead / 3600) === 1 ? "" : "s"}`;
    return `in ${Math.round(ahead / 86400)} day${Math.round(ahead / 86400) === 1 ? "" : "s"}`;
  }
  if (diff < 45) return "just now";
  if (diff < 90) return "1 min ago";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 5400) return "1 hour ago";
  if (diff < 86400) return `${Math.round(diff / 3600)} hours ago`;
  if (diff < 172800) return "yesterday";
  if (diff < 604800) return `${Math.round(diff / 86400)} days ago`;
  if (diff < 1209600) return "1 week ago";
  if (diff < 2629800) return `${Math.round(diff / 604800)} weeks ago`;
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
