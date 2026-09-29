/**
 * Home orchestration rules (docs/phases/02-home-quick-capture.md §3, §8, §12–13). Pure and deterministic, so they're
 * tested on their own and the client never reconstructs them. Phases 03 and 05 extend this by adding candidates and
 * slots, not by changing the page.
 *
 * Nothing here is ever shown as a number or a score: rank only decides what earns a place and what's left out.
 */

export type HomeMode = "active" | "return" | "quiet";

export type HomeCandidateKind =
  | "requires_decision"
  | "active_work_change"
  | "collaborator_response"
  | "completed_output"
  | "moment_connection"
  | "relevant_conversation"
  | "help_opportunity"
  | "relevant_huddle"
  | "creative_memory"
  | "general_activity";

/** Base priority order (§13), most significant first. */
export const CANDIDATE_ORDER: readonly HomeCandidateKind[] = [
  "requires_decision",
  "active_work_change",
  "collaborator_response",
  "completed_output",
  "moment_connection",
  "relevant_conversation",
  "help_opportunity",
  "relevant_huddle",
  "creative_memory",
  "general_activity",
];
export const candidateRank = (k: HomeCandidateKind) => CANDIDATE_ORDER.indexOf(k);

/** Home's optional modules, in the order they sit on the page (stable placement; rank decides only who's in). */
export const HOME_SLOTS = ["whileAway", "yourQuestion", "worldConnecting", "dejavu", "spark", "worthHearing", "couldHelp"] as const;
export type HomeSlot = (typeof HOME_SLOTS)[number];

/** After this long away, Home is a "Return Home" (§3). */
export const RETURN_AFTER_HOURS = 48;
/** Roughly 5–7 meaningful items (§2): Continue and Quick Capture, plus at most this many modules. */
export const MAX_MODULES = { active: 3, return: 5, quiet: 1 } as const;

const DISCOVERY: HomeSlot[] = ["worldConnecting", "dejavu", "spark"];
const HUMAN: HomeSlot[] = ["yourQuestion", "couldHelp", "worthHearing"];

/**
 * Which mode Home is in. Quiet when nothing needs attention (a memory alone doesn't count, and neither does someone
 * else's post — but a live Huddle does); Return after a real absence with something to show; Active otherwise. First visit: Active.
 */
export function homeMode(input: { lastVisit: string | null; now: number; available: Partial<Record<HomeSlot, HomeCandidateKind>> }): HomeMode {
  const a = input.available;
  // Something live right now, or a conversation with a reason to hear it, is worth a look; someone's post alone isn't.
  const live = a.worthHearing === "relevant_huddle" || a.worthHearing === "relevant_conversation";
  const meaningful = !!(a.whileAway || a.yourQuestion || a.couldHelp || a.worldConnecting || a.dejavu || live);
  if (!meaningful) return "quiet";
  if (input.lastVisit && input.now - Date.parse(input.lastVisit) >= RETURN_AFTER_HOURS * 3600_000) return "return";
  return "active";
}

/**
 * Which modules make it onto Home. Active: the update, one discovery and one human signal. Return: the most
 * significant, up to the cap. Quiet: at most one pleasant memory. Always in page order.
 */
export function selectSlots(mode: HomeMode, available: Partial<Record<HomeSlot, HomeCandidateKind>>): HomeSlot[] {
  const have = (s: HomeSlot) => !!available[s];
  const best = (group: HomeSlot[]) =>
    group.filter(have).sort((x, y) => candidateRank(available[x]!) - candidateRank(available[y]!) || group.indexOf(x) - group.indexOf(y))[0];
  let chosen: HomeSlot[];
  if (mode === "quiet") chosen = have("spark") ? ["spark"] : [];
  else if (mode === "active") chosen = [have("whileAway") ? "whileAway" : null, best(DISCOVERY), best(HUMAN)].filter((s): s is HomeSlot => !!s);
  else
    chosen = HOME_SLOTS.filter(have)
      .sort((x, y) => candidateRank(available[x]!) - candidateRank(available[y]!) || HOME_SLOTS.indexOf(x) - HOME_SLOTS.indexOf(y))
      .slice(0, MAX_MODULES.return);
  return HOME_SLOTS.filter((s) => chosen.includes(s)).slice(0, MAX_MODULES[mode]);
}

/* ----------------------------------------------------------------------------------------- While you were away */

export interface AwayItem {
  id: string;
  /** What happened, in the source's own words ("comment", "visuals_ready", "publish_failed", "shared_with_you"…). */
  kind: string;
  candidate: HomeCandidateKind;
  title: string;
  href: string;
  at: string;
}

export interface HomeSummary {
  total: number;
  lines: Array<{ text: string; href: string }>;
  candidate: HomeCandidateKind;
}

const GROUP: Record<string, [one: string, many: string]> = {
  comment: ["new comment", "new comments"],
  visuals_ready: ["set of visuals ready", "sets of visuals ready"],
  publish_failed: ["publish failed", "publishes failed"],
  shared_with_you: ["Creation shared with you", "Creations shared with you"],
  proposal_decided: ["change decided", "changes decided"],
  collaborator_added: ["new collaborator", "new collaborators"],
  license_response: ["license reply", "license replies"],
  message: ["new message", "new messages"],
};

/**
 * A summary, not a notification list (§8): three things or fewer are named; more are grouped by what happened
 * ("2 new comments · 3 sets of visuals ready"), most significant first, never more than three lines.
 */
export function summarizeAway(items: AwayItem[]): HomeSummary | null {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => candidateRank(a.candidate) - candidateRank(b.candidate) || b.at.localeCompare(a.at));
  const candidate = sorted[0]!.candidate;
  if (items.length <= 3) return { total: items.length, candidate, lines: sorted.map((i) => ({ text: i.title, href: i.href })) };
  const groups = new Map<string, AwayItem[]>();
  for (const i of sorted) groups.set(i.kind, [...(groups.get(i.kind) ?? []), i]);
  const entries = [...groups.entries()];
  const line = ([kind, list]: [string, AwayItem[]]) => {
    if (list.length === 1) return { text: list[0]!.title, href: list[0]!.href };
    const [, many] = GROUP[kind] ?? ["update", "updates"];
    return { text: `${list.length} ${many}`, href: list[0]!.href };
  };
  if (entries.length <= 3) return { total: items.length, candidate, lines: entries.map(line) };
  const rest = entries.slice(2).reduce((n, [, list]) => n + list.length, 0);
  return { total: items.length, candidate, lines: [...entries.slice(0, 2).map(line), { text: `${rest} more updates`, href: "#notifications" }] };
}

/* ------------------------------------------------------------------------------------------------ Context Line */

/**
 * Home's one current truth for the navbar (§12), 2–7 words. Operational states (errors, offline, live, approvals,
 * saving) are raised elsewhere at higher priority and always win over this.
 */
export function homeContextLine(input: {
  mode: HomeMode;
  whileAway?: HomeSummary | null;
  singleReady?: string | null;
  waiting?: number;
  questionReplies?: number;
  connection?: boolean;
  dejavuName?: string | null;
}): string {
  if (input.mode === "quiet") return "Nothing urgent";
  if (input.whileAway?.total) {
    if (input.whileAway.total === 1 && input.singleReady) return input.singleReady;
    return `${input.whileAway.total} ${input.whileAway.total === 1 ? "thing" : "things"} changed`;
  }
  if (input.questionReplies) return `${input.questionReplies} ${input.questionReplies === 1 ? "reply" : "replies"} to your question`;
  if (input.waiting) return `${input.waiting} waiting on you`;
  if (input.connection) return "A new connection was found";
  if (input.dejavuName) return `${input.dejavuName.length > 24 ? `${input.dejavuName.slice(0, 23)}…` : input.dejavuName} surfaced again`;
  return "Nothing urgent";
}

/* ---------------------------------------------------------------------------------------------------- Continue */

export interface ContinueSignal {
  id: string;
  status: string;
  updatedAt: string;
  /** Autosaved Studio draft newer than the saved version (unsaved work). */
  unsavedDraft?: boolean;
  /** Visuals being made for it right now. */
  generating?: boolean;
  /** Comments from other people since the last visit. */
  newComments?: number;
}

/**
 * The one Creation with the highest continuation value (§5): unsaved work and output in flight first, then what
 * collaborators touched, then work in progress over finished work, then the most recent. Deterministic.
 */
export function pickContinue<T extends ContinueSignal>(candidates: T[], now: number): T | null {
  const value = (c: T) => {
    const hours = (now - Date.parse(c.updatedAt)) / 3600_000;
    return (
      (c.unsavedDraft ? 40 : 0) +
      (c.generating ? 30 : 0) +
      (c.newComments ? 20 : 0) +
      (c.status === "draft" || c.status === "in_review" ? 10 : 0) +
      (hours <= 24 ? 6 : hours <= 24 * 7 ? 3 : 0)
    );
  };
  return [...candidates].sort((a, b) => value(b) - value(a) || b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}
