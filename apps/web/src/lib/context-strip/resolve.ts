import type { Lifecycle, PalettePage } from "../palette/types";
import { PRIORITY, type StripFacts, type StripItem, type StripModel } from "./types";

export interface StripInput {
  page: PalettePage | null;
  lifecycle?: Lifecycle;
  facts?: StripFacts;
  /** Transient signals raised by the screen (Saving…, Saved, Publish failed). Expired ones are ignored. */
  signals?: StripItem[];
  online?: boolean;
  now?: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const VISIBILITY = { private: "Private", shared: "Shared", public: "Public" } as const;
export const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * resolveContextStrip (§15): collect critical → active → live → pending → save/processing → lifecycle → presence →
 * metadata; take the most important; optionally one secondary from a different tier. Deterministic, no AI, no fetching.
 */
export function resolveContextStrip({ page, lifecycle, facts = {}, signals = [], online = true, now = Date.now() }: StripInput): StripModel {
  const f = facts;
  const c: StripItem[] = signals.filter((s) => !s.expiresAt || s.expiresAt > now);

  if (f.publishState === "failed") c.push({ id: "publish-failed", text: "Publish failed", tone: "error", priority: PRIORITY.error });
  if (!online) c.push({ id: "offline", text: page === "studio" ? "Offline · Saved locally" : "Offline", shortText: "Offline", tone: "warning", priority: PRIORITY.offline });
  if (f.publishState === "publishing") c.push({ id: "publishing", text: "Publishing…", tone: "active", priority: PRIORITY.external });
  if (f.liveSince) c.push({ id: "live", text: f.participantCount ? `Live · ${plural(f.participantCount, "person", "people")}` : "Live", shortText: "Live", tone: "live", priority: PRIORITY.live, since: f.liveSince });
  if (f.pendingApprovalCount) {
    const text = `${plural(f.pendingApprovalCount, "approval", "approvals")} pending`;
    c.push({ id: "approvals", text, tone: "warning", priority: PRIORITY.pending, href: page === "approvals" ? undefined : "/approvals" });
  }
  if (f.selectedCount) c.push({ id: "selected", text: `${f.selectedCount} selected`, tone: "active", priority: PRIORITY.save });
  if (f.importingCount) c.push({ id: "importing", text: `${f.importingCount} importing…`, tone: "active", priority: PRIORITY.save });
  if (f.processing) c.push({ id: "processing", text: f.processing, tone: "active", priority: PRIORITY.save });

  // Meaningful Home context (phase 02 §12): below every operational state, above lifecycle and metadata.
  if (page === "home" && f.homeLine) c.push({ id: "home", text: f.homeLine, tone: f.homeLine === "Nothing urgent" ? "neutral" : "active", priority: PRIORITY.semantic });
  const life = lifecycleItem(lifecycle, f);
  if (life) c.push(life);
  if (f.collaboratorCount && f.collaboratorCount > 0)
    c.push({ id: "presence", text: `${plural(f.collaboratorCount, "collaborator", "collaborators")} here`, shortText: `${f.collaboratorCount} here`, tone: "neutral", priority: PRIORITY.presence });
  const meta = metadataItem(page, f);
  if (meta) c.push(meta);

  const ranked = c.sort((a, b) => a.priority - b.priority);
  const primary = ranked[0] ?? null;
  const secondary = primary ? (ranked.find((x) => x.priority !== primary.priority && x.priority >= PRIORITY.save && x.id !== primary.id) ?? null) : null;
  return { primary, secondary };
}

function lifecycleItem(lifecycle: Lifecycle | undefined, f: StripFacts): StripItem | null {
  if (!lifecycle) return null;
  const v = f.version ? `v${f.version}` : null;
  const vis = f.visibility ? VISIBILITY[f.visibility] : null;
  const item = (text: string, shortText?: string, tone: StripItem["tone"] = "neutral"): StripItem => ({ id: "lifecycle", text, shortText, tone, priority: PRIORITY.lifecycle });
  switch (lifecycle) {
    case "idea":
      return item(v ? `${v} · Draft` : "Draft", "Draft");
    case "in-progress":
      return item(v ? `${v} · In progress` : "In progress", v ?? undefined);
    case "review":
      return item(v ? `${v} · In review` : "In review", "In review");
    case "finished":
      return item(vis ? `Finished · ${vis}` : "Finished", "Finished");
    case "published":
      if (f.publishState === "scheduled" && f.scheduledFor) return item(`Scheduled · ${f.scheduledFor}`, "Scheduled", "active");
      return item(f.publishedTo ? `Published · ${f.publishedTo}` : "Published", "Published", "success");
    case "archived":
      return item("Archived");
  }
}

function metadataItem(page: PalettePage | null, f: StripFacts): StripItem | null {
  const item = (text: string, shortText?: string, extra: Partial<StripItem> = {}): StripItem => ({ id: "meta", text, shortText, tone: "neutral", priority: PRIORITY.metadata, ...extra });
  if (page === "home") {
    if (f.continueTitle) return item(`${f.continueTitle} · In progress`, "In progress");
    if (f.ideasWaiting) return item(plural(f.ideasWaiting, "idea waiting", "ideas waiting"), undefined, { tone: "active" });
    return item("Ready to create");
  }
  if (f.ready) return item(f.ready, undefined, { tone: "success" });
  if (f.kindLabel) {
    const detail = f.durationSeconds ? clock(f.durationSeconds) : f.date;
    return item(detail ? `${f.kindLabel} · ${detail}` : f.kindLabel, f.kindLabel);
  }
  if (f.count) return item(plural(f.count[0], f.count[1], f.count[2]));
  if (f.dueAt) return item(`Due ${f.dueAt}`);
  if (f.label) return item(f.label);
  return null;
}
