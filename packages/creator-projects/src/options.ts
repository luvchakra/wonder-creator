/** Client-safe project vocabulary (no database access). */
export const PROJECT_STATUSES = ["idea", "active", "paused", "completed", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  idea: "Idea",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

export const PROJECT_ITEM_KINDS = ["material", "reference", "artifact", "collection", "conversation", "huddle"] as const;
export type ProjectItemKind = (typeof PROJECT_ITEM_KINDS)[number];

export const PROJECT_ITEM_LABEL: Record<ProjectItemKind, { one: string; many: string }> = {
  material: { one: "Material", many: "Material" },
  reference: { one: "Reference", many: "References" },
  artifact: { one: "Creation", many: "Creations" },
  collection: { one: "Collection", many: "Collections" },
  conversation: { one: "Conversation", many: "Conversations" },
  huddle: { one: "Huddle", many: "Huddles" },
};

export const MAX_GOALS = 12;

/** What a project list shows (client-safe shape). */
export interface ProjectCard {
  id: string;
  title: string;
  brief: string;
  status: ProjectStatus;
  updatedAt: string;
  coverObjectId: string | null;
  counts: Record<ProjectItemKind, number>;
  /** Set when the project is someone else's and the viewer is in its crew. */
  owner: { id: string; name: string } | null;
}

export type CrewStatus = "forming" | "active" | "completed";
export type CrewAccess = "owner" | "admin" | "member";
export type CrewMemberStatus = "invited" | "active" | "declined" | "cancelled" | "left" | "removed";

export const CREW_STATUS_LABEL: Record<CrewStatus, string> = { forming: "Forming", active: "Active", completed: "Completed" };
export const CREW_ACCESS_LABEL: Record<CrewAccess, string> = { owner: "Owner", admin: "Admin", member: "Member" };
export const CREW_ACCESS_HELP: Record<CrewAccess, string> = {
  owner: "Started the crew; manages everyone.",
  admin: "Can invite people and manage members.",
  member: "Part of the crew; can see the Creative Room.",
};

/** Examples only: creators can name any role. */
export const ROLE_SUGGESTIONS = ["Creator", "Director", "Writer", "Filmmaker", "Cinematographer", "Musician", "Editor", "Visual artist", "Designer", "Producer", "Sound", "Performer", "Researcher", "Photographer"];

export const TASK_STATUSES = ["todo", "in_progress", "review", "done", "blocked"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { todo: "To do", in_progress: "In progress", review: "Review", done: "Done", blocked: "Blocked" };
/** Current and blocked work first (mobile guidelines: content priority). */
export const TASK_GROUP_ORDER: TaskStatus[] = ["blocked", "in_progress", "review", "todo", "done"];

export const CONTRIBUTION_KINDS = ["writing", "editing", "idea", "material", "direction", "design", "sound", "performance", "research", "production", "review", "task", "other"] as const;
export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];
export const CONTRIBUTION_KIND_LABEL: Record<ContributionKind, string> = {
  writing: "Writing",
  editing: "Editing",
  idea: "Idea",
  material: "Material",
  direction: "Direction",
  design: "Design",
  sound: "Sound & music",
  performance: "Performance",
  research: "Research",
  production: "Production",
  review: "Review",
  task: "Task",
  other: "Other",
};
export const RIGHTS_RELATIONSHIP_LABEL = { contributor: "Contributor", co_owner: "Co-owner", licensed: "Licensed", work_for_hire: "Work for hire", none: "No rights" } as const;
export const ATTRIBUTION_LABEL = { required: "Credit required", optional: "Credit optional", none: "No credit" } as const;

export const DERIVATIVE_POLICIES = ["owner_approval", "crew_allowed", "not_allowed"] as const;
export type DerivativePolicy = (typeof DERIVATIVE_POLICIES)[number];
export const DERIVATIVE_POLICY_LABEL: Record<DerivativePolicy, { label: string; help: string }> = {
  owner_approval: { label: "Owner decides", help: "Each Creation's owner allows derivatives on its rights record or through a license." },
  crew_allowed: { label: "Crew may adapt", help: "People in the Creative Room can make derivatives of Creations they can open. Lineage and credit are kept." },
  not_allowed: { label: "No derivatives", help: "Only a Creation's owner can make derivatives of it." },
};
export const ATTRIBUTION_POLICIES = ["credit_all", "as_agreed"] as const;
export type AttributionPolicy = (typeof ATTRIBUTION_POLICIES)[number];
export const ATTRIBUTION_POLICY_LABEL: Record<AttributionPolicy, { label: string; help: string }> = {
  credit_all: { label: "Credit everyone", help: "Everyone who contributed is credited wherever the work appears." },
  as_agreed: { label: "As agreed", help: "Credit follows each contribution's attribution setting and the agreement below." },
};
export const OWNERSHIP_CLAIMS = ["sole_owner", "co_owner", "contributor_only", "no_claim"] as const;
export type OwnershipClaim = (typeof OWNERSHIP_CLAIMS)[number];
export const OWNERSHIP_CLAIM_LABEL: Record<OwnershipClaim, string> = {
  sole_owner: "Sole owner",
  co_owner: "Co-owner",
  contributor_only: "Contributor only",
  no_claim: "No ownership claim",
};
export type AssertionStatus = "asserted" | "acknowledged" | "disputed" | "withdrawn";
export const ASSERTION_STATUS_LABEL: Record<AssertionStatus, string> = { asserted: "Awaiting response", acknowledged: "Acknowledged", disputed: "Disputed", withdrawn: "Withdrawn" };
export const PROJECT_RIGHTS_DISCLAIMER =
  "These are platform records of what people in the Creative Room said and agreed — not legal determinations. Contributing to a Creation doesn't by itself make anyone its owner.";
