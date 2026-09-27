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
  artifact: { one: "Piece", many: "Pieces" },
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
  member: "Part of the crew; can see the project.",
};

/** Examples only: creators can name any role. */
export const ROLE_SUGGESTIONS = ["Director", "Writer", "Cinematographer", "Musician", "Editor", "Visual artist", "Designer", "Producer", "Sound", "Performer", "Researcher", "Photographer"];
