import type { Enums } from "@wonder/db";

export type AutonomyDomain = Enums<"autonomy_domain">;
export type AutonomyLevel = Enums<"autonomy_level">;

export const AUTONOMY_DOMAINS: Array<{ domain: AutonomyDomain; label: string; description: string }> = [
  { domain: "creative_generation", label: "Creative Generation", description: "Create new content, ideas and drafts" },
  { domain: "research", label: "Research", description: "Search and gather references" },
  { domain: "transformation", label: "Transformation", description: "Edit, refine and reimagine existing work" },
  { domain: "organization", label: "Organization", description: "Organize materials, artifacts and projects" },
  { domain: "collaboration", label: "Collaboration", description: "Invite creators, start huddles" },
  { domain: "communication", label: "Communication", description: "Send messages on your behalf" },
  { domain: "publishing", label: "Publishing", description: "Publish to platforms and schedules" },
  { domain: "commerce", label: "Commerce", description: "Sell, license or commercial use" },
  { domain: "rights", label: "Rights", description: "Manage licenses and usage rights" },
  { domain: "destructive_actions", label: "Destructive Actions", description: "Delete, permanently remove or sensitive changes" },
];

export const AUTONOMY_LEVELS: Array<{ level: AutonomyLevel; label: string; description: string }> = [
  { level: "never", label: "Never", description: "CreatorBrain will not do this" },
  { level: "observe", label: "Observe", description: "Only view and analyze. No actions." },
  { level: "suggest", label: "Suggest", description: "Provide ideas and suggestions" },
  { level: "draft", label: "Draft", description: "Create drafts for your review" },
  { level: "execute_with_approval", label: "Ask for approval", description: "Take actions with your approval" },
  { level: "auto_execute", label: "Auto-execute", description: "Take actions automatically within limits" },
];

/** Product defaults, shown to the creator and restorable with "Reset to defaults". */
export const DEFAULT_AUTONOMY: Record<AutonomyDomain, AutonomyLevel> = {
  creative_generation: "auto_execute",
  research: "auto_execute",
  transformation: "draft",
  organization: "draft",
  collaboration: "execute_with_approval",
  communication: "execute_with_approval",
  publishing: "execute_with_approval",
  commerce: "never",
  rights: "never",
  destructive_actions: "never",
};

/** Domains where CreatorBrain may never act on its own, whatever the creator sets. */
export const HARD_CEILING: Partial<Record<AutonomyDomain, AutonomyLevel>> = {
  commerce: "execute_with_approval",
  rights: "execute_with_approval",
  destructive_actions: "execute_with_approval",
};

const ORDER: AutonomyLevel[] = ["never", "observe", "suggest", "draft", "execute_with_approval", "auto_execute"];

export function levelRank(level: AutonomyLevel): number {
  return ORDER.indexOf(level);
}

export function clampLevel(domain: AutonomyDomain, level: AutonomyLevel): AutonomyLevel {
  const ceiling = HARD_CEILING[domain];
  if (ceiling && levelRank(level) > levelRank(ceiling)) return ceiling;
  return level;
}

export type ActionKind = "analyze" | "suggest" | "draft" | "execute";

export type AutonomyDecision =
  | { outcome: "allowed" }
  | { outcome: "needs_approval"; reason: string }
  | { outcome: "denied"; reason: string };

/**
 * Deterministic autonomy check. The model never decides this.
 * - analyze: needs at least OBSERVE
 * - suggest: needs at least SUGGEST
 * - draft (creates a reviewable draft, never overwrites): needs DRAFT
 * - execute (consequential): AUTO_EXECUTE runs; EXECUTE_WITH_APPROVAL asks; below that is denied
 */
export function decideAutonomy(domain: AutonomyDomain, configured: AutonomyLevel, action: ActionKind): AutonomyDecision {
  const level = clampLevel(domain, configured);
  const rank = levelRank(level);
  const label = AUTONOMY_DOMAINS.find((d) => d.domain === domain)?.label ?? domain;
  if (level === "never") return { outcome: "denied", reason: `${label} is set to Never.` };
  switch (action) {
    case "analyze":
      return rank >= levelRank("observe") ? { outcome: "allowed" } : { outcome: "denied", reason: `${label} does not allow analysis.` };
    case "suggest":
      return rank >= levelRank("suggest") ? { outcome: "allowed" } : { outcome: "denied", reason: `${label} is set to observe only.` };
    case "draft":
      if (rank >= levelRank("draft")) return { outcome: "allowed" };
      return { outcome: "denied", reason: `${label} is set to ${ORDER[rank]}, which doesn't allow drafts.` };
    case "execute":
      if (level === "auto_execute") return { outcome: "allowed" };
      if (level === "execute_with_approval" || level === "draft") {
        return { outcome: "needs_approval", reason: `${label} asks for your approval first.` };
      }
      return { outcome: "denied", reason: `${label} doesn't allow CreatorBrain to act.` };
  }
}
