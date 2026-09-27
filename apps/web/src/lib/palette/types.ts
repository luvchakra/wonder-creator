/**
 * The context-aware Palette (docs/ui-redesign/palette-spec.md). Pages describe *where the creator is*; the resolver
 * decides what's worth offering. Pure data — no React, no data access — so it's testable and never holds business rules
 * that belong on the server (the Palette only hides what the server would refuse anyway; it is not a security boundary).
 */

export type PaletteIcon = "home" | "pen" | "images" | "users" | "user" | "spark" | "add" | "camera" | "mic" | "search" | "compass" | "people" | "room" | "more" | "go" | "back";

/** §13 action classes. DANGEROUS never reaches the first level. */
export type PaletteClass = "navigation" | "create" | "transform" | "context" | "collaboration" | "share" | "publish" | "rights" | "utility" | "dangerous";

export type PaletteTarget = { kind: "route"; href: string } | { kind: "command"; command: "metalk" | "create-menu" | "global" | "more" | "back" };

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon?: PaletteIcon;
  class: PaletteClass;
  target: PaletteTarget;
  /** §14 conceptual score: higher is more relevant here. */
  score: number;
  /** Only offered when the viewer holds this permission (the server enforces it too). */
  requires?: Permission;
  current?: boolean;
}

export type Permission = "edit" | "publish" | "rights" | "collaborate" | "invite";

export type PalettePage =
  | "home"
  | "global"
  | "materials"
  | "material"
  | "collection"
  | "creation"
  | "studio"
  | "context"
  | "transform"
  | "compare"
  | "derivatives"
  | "share"
  | "publish"
  | "room"
  | "crew"
  | "huddles"
  | "huddle"
  | "huddle-summary"
  | "me"
  | "creator"
  | "discover"
  | "search"
  | "explore"
  | "approvals"
  | "approval"
  | "publishing"
  | "settings"
  | "spaces";

export type MaterialKind = "photo" | "audio" | "video" | "note" | "document" | "link";
export type Lifecycle = "idea" | "in-progress" | "review" | "finished" | "published" | "archived";

export interface PaletteContext {
  page: PalettePage;
  entityType?: MaterialKind | "creation" | "collection" | "room";
  lifecycle?: Lifecycle;
  permissions?: Permission[];
  /** Ids of the object on screen, for building its links. */
  ids?: { artifactId?: string; materialId?: string; projectId?: string; crewId?: string; huddleId?: string; collectionId?: string; approvalArtifactId?: string };
  /** Small facts that change the offer (e.g. a room with or without an active Creation). */
  facts?: { activeCreationId?: string | null; related?: string | null; hasCrew?: boolean; format?: string; name?: string | null };
  /** Current path, to mark the global destination you're on. */
  pathname?: string;
}

export interface PaletteModel {
  /** Short title for the contextual group ("This Creation"), announced to screen readers. */
  title: string | null;
  primary: PaletteItem[];
  more: PaletteItem[];
  /** True for the global destinations (Home, Create, Materials, Huddles, Explore, Me). */
  global: boolean;
}
