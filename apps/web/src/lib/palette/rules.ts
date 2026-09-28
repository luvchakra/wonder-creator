import type { PaletteContext, PaletteItem } from "./types";

/**
 * Per-page candidates (palette-spec §9), scored per §14: current-object action ≈100, lifecycle next step ≈90, media-type
 * relevance ≈80, collaboration ≈70, continuity ≈50, utility ≈30, admin ≈20. Only routes and features that exist today
 * are offered — nothing links to an unbuilt screen (e.g. no Analytics or "Upcoming" Huddles yet).
 */

const route = (href: string) => ({ kind: "route" as const, href });
const cmd = (command: "metalk" | "create-menu") => ({ kind: "command" as const, command });

export const GLOBAL_ITEMS = (pathname = ""): PaletteItem[] => [
  { id: "home", label: "Home", hint: "Where you left off and what's waiting", icon: "home", class: "navigation", target: route("/"), score: 60, current: pathname === "/" },
  {
    id: "create",
    label: "Create",
    hint: "New Creation, Bring Material, Capture or meTalk",
    icon: "spark",
    class: "create",
    target: cmd("create-menu"),
    score: 59,
    current: pathname.startsWith("/create"),
  },
  {
    id: "materials",
    label: "Materials",
    hint: "Photos, notes, voice and everything you've brought in",
    icon: "images",
    class: "navigation",
    target: route("/space?tab=ideas"),
    score: 58,
    current: pathname.startsWith("/space"),
  },
  {
    id: "huddles",
    label: "Huddles",
    hint: "Live conversations with other creators",
    icon: "users",
    class: "navigation",
    target: route("/huddles"),
    score: 57,
    current: pathname.startsWith("/huddles"),
  },
  {
    id: "explore",
    label: "Explore",
    hint: "Search and discover across Wonder Creator",
    icon: "compass",
    class: "navigation",
    target: route("/search"),
    score: 56,
    current: pathname.startsWith("/search") || pathname.startsWith("/discover"),
  },
  {
    id: "me",
    label: "Me",
    hint: "Your profile, Creations and settings",
    icon: "user",
    class: "navigation",
    target: route("/profile"),
    score: 55,
    current: pathname.startsWith("/profile") || pathname.startsWith("/creators"),
  },
];

export const CREATE_ITEMS: PaletteItem[] = [
  { id: "new", label: "New Creation", hint: "Start a piece from an idea or from your Materials", icon: "spark", class: "create", target: route("/create"), score: 100 },
  { id: "bring", label: "Bring Material", hint: "Upload, paste a link or import", icon: "add", class: "create", target: route("/send"), score: 99 },
  { id: "capture", label: "Capture", hint: "Photo, voice or a note", icon: "camera", class: "create", target: route("/send"), score: 98 },
  { id: "metalk", label: "meTalk", hint: "Say what you want to make", icon: "mic", class: "create", target: cmd("metalk"), score: 97 },
];

type Rules = { title: string | null; items: PaletteItem[] };

export function rulesFor(ctx: PaletteContext): Rules {
  const i = ctx.ids ?? {};
  const f = ctx.facts ?? {};
  const a = i.artifactId ? `/artifacts/${i.artifactId}` : "";
  switch (ctx.page) {
    case "home":
      // A calm point of departure: the global destinations without Home itself (§9.1).
      return { title: null, items: GLOBAL_ITEMS(ctx.pathname).filter((x) => x.id !== "home") };

    case "materials":
      return {
        title: "Materials",
        items: [
          { id: "bring", label: "Bring Material", icon: "add", class: "create", target: route("/send"), score: 100 },
          { id: "capture", label: "Capture", hint: "Photo, voice or a note", icon: "camera", class: "create", target: route("/send"), score: 95 },
          { id: "collections", label: "Collections", icon: "images", class: "context", target: route("/space?tab=collections"), score: 80 },
          { id: "explore", label: "Explore", icon: "compass", class: "navigation", target: route("/search"), score: 70 },
        ],
      };

    case "material": {
      const m = i.materialId!;
      const create: PaletteItem = { id: "create-with", label: "Create with this", icon: "spark", class: "create", target: route(`/create?material=${m}`), score: 100 };
      const related: PaletteItem[] = f.related
        ? [{ id: "related", label: "Find related", icon: "search", class: "context", target: route(`/search?q=${encodeURIComponent(f.related)}`), score: 85 }]
        : [];
      const collect: PaletteItem = { id: "collect", label: "Add to Collection", icon: "images", class: "context", target: route(`/space/materials/${m}#collections`), score: 80 };
      const explore: PaletteItem = { id: "explore", label: "Explore possibilities", icon: "compass", class: "create", target: route(`/create/discover?material=${m}`), score: 75 };
      const edit: PaletteItem = { id: "edit", label: "Edit details", class: "utility", target: route(`/space/materials/${m}#details`), score: 30, requires: "edit" };
      const byKind: PaletteItem[] =
        ctx.entityType === "audio"
          ? [{ id: "words", label: "Use the words", hint: "The transcript", icon: "mic", class: "create", target: route(`/space/materials/${m}#transcript`), score: 90 }]
          : ctx.entityType === "note" || ctx.entityType === "document"
            ? [{ ...explore, id: "ideas", label: "Extract ideas", score: 90 }]
            : [];
      return { title: "This Material", items: [create, ...byKind, ...related, collect, ...(byKind.some((x) => x.id === "ideas") ? [] : [explore]), edit] };
    }

    case "collection":
      return {
        title: "This Collection",
        items: [
          { id: "create-from", label: "Create from Collection", icon: "spark", class: "create", target: route(`/create?collection=${i.collectionId}`), score: 100 },
          { id: "add", label: "Add Material", icon: "add", class: "create", target: route("/send"), score: 90 },
          ...(f.name ? [{ id: "related", label: "Explore related", icon: "search" as const, class: "context" as const, target: route(`/search?q=${encodeURIComponent(f.name)}`), score: 80 }] : []),
        ],
      };

    case "creation":
      return { title: "This Creation", items: creationItems(ctx, a) };

    case "studio":
      // §9.16–9.19: the canvas stays dominant; editor controls stay in the editor. Materials, References and Context
      // live in the Studio's Working Set now (creative-studio-working-set.md §66), and Refine is on the page itself.
      return {
        title: "This Creation",
        items: [
          {
            id: "transform",
            label: "Transform",
            hint: "Turn this Creation into another format (video, audio, document…)",
            icon: "pen",
            class: "transform",
            target: route(`${a}/transform`),
            score: 100,
            requires: "edit",
          },
          {
            id: "people",
            label: "People",
            hint: "Who's working on it and what each person may do",
            icon: "people",
            class: "collaboration",
            target: route(`${a}/collaborate`),
            score: 95,
            requires: "collaborate",
          },
          { id: "versions", label: "Versions", hint: "Every saved version — compare or restore one", class: "context", target: route(`${a}?tab=versions`), score: 90 },
          { id: "visuals", label: "Visual directions", hint: "Images made from this Creation", icon: "images", class: "create", target: route(`${a}#visual-directions`), score: 60, requires: "edit" },
          { id: "share", label: "Share", hint: "A private link for people you choose", class: "share", target: route(`${a}/share`), score: 40, requires: "publish" },
        ],
      };

    case "context":
      return {
        title: "Around this Creation",
        items: [
          { id: "add-material", label: "Add Material", icon: "add", class: "create", target: route(`/create?artifact=${i.artifactId}`), score: 100, requires: "edit" },
          { id: "add-person", label: "Add Person", icon: "people", class: "collaboration", target: route(`${a}/collaborate`), score: 90, requires: "collaborate" },
          { id: "connections", label: "Explore Connections", icon: "compass", class: "context", target: route(`${a}/context?tab=related`), score: 80 },
          { id: "open", label: "Back to the Creation", icon: "pen", class: "navigation", target: route(a), score: 70 },
        ],
      };

    case "transform":
      return {
        title: "Transform",
        items: [
          { id: "references", label: "Use References", icon: "images", class: "context", target: route(`${a}/context?tab=references`), score: 90 },
          { id: "destination", label: "For a destination", hint: "YouTube description, post, thumbnail…", icon: "spark", class: "transform", target: route(`${a}/derivatives`), score: 85 },
          { id: "lineage", label: "View Lineage", class: "context", target: route(`${a}/context?tab=related`), score: 50 },
        ],
      };

    case "compare":
      return {
        title: "Versions",
        items: [
          { id: "open", label: "Back to the Creation", icon: "pen", class: "navigation", target: route(`${a}?tab=versions`), score: 90 },
          { id: "studio", label: "Create a new version", hint: "In the Creative Studio", icon: "spark", class: "create", target: route(`${a}/studio`), score: 85, requires: "edit" },
          { id: "lineage", label: "Lineage", class: "context", target: route(`${a}/context?tab=related`), score: 50 },
        ],
      };

    case "derivatives":
      return {
        title: "For a destination",
        items: [
          { id: "source", label: "Open source Creation", icon: "pen", class: "navigation", target: route(a), score: 90 },
          { id: "publish", label: "Publish", class: "publish", target: route(`${a}/publish`), score: 85, requires: "publish" },
          { id: "transform", label: "Transform into another form", class: "transform", target: route(`${a}/transform`), score: 60, requires: "edit" },
        ],
      };

    case "share":
      return {
        title: "Share",
        items: [
          { id: "invite", label: "Invite People", icon: "people", class: "collaboration", target: route(`${a}/collaborate`), score: 90, requires: "invite" },
          { id: "publish", label: "Publish instead", class: "publish", target: route(`${a}/publish`), score: 70, requires: "publish" },
          { id: "open", label: "Back to the Creation", icon: "pen", class: "navigation", target: route(a), score: 60 },
        ],
      };

    case "publish":
      return {
        title: "Publish",
        items: [
          { id: "history", label: "Publication history", class: "context", target: route("/publishing"), score: 80 },
          { id: "destination", label: "Make a version for a destination", icon: "spark", class: "transform", target: route(`${a}/derivatives`), score: 75, requires: "edit" },
          { id: "open", label: "Back to the Creation", icon: "pen", class: "navigation", target: route(a), score: 60 },
        ],
      };

    case "room": {
      const room = `/projects/${i.projectId}`;
      const active = f.activeCreationId;
      return {
        title: "This Creative Room",
        items: [
          active
            ? { id: "studio", label: "Open Studio", icon: "pen", class: "create", target: route(`/artifacts/${active}/studio`), score: 100, requires: "edit" }
            : { id: "start", label: "Start Creation", icon: "spark", class: "create", target: route(`/create?project=${i.projectId}`), score: 100, requires: "edit" },
          { id: "bring", label: "Bring Material", icon: "add", class: "create", target: route("/send"), score: 90 },
          f.hasCrew && i.crewId
            ? { id: "people", label: "People", icon: "people", class: "collaboration", target: route(`/crews/${i.crewId}`), score: 80 }
            : { id: "invite", label: "Invite People", icon: "people", class: "collaboration", target: route(`/discover?project=${i.projectId}`), score: 80, requires: "invite" },
          { id: "huddle", label: f.hasCrew ? "Chat & Huddle" : "Start Huddle", icon: "users", class: "collaboration", target: route(f.hasCrew ? `${room}?tab=chat` : "/huddles"), score: 70 },
          { id: "tasks", label: "Tasks", class: "context", target: route(`${room}?tab=tasks`), score: 50 },
          { id: "rights", label: "Rights", class: "rights", target: route(`${room}?tab=rights`), score: 40 },
          { id: "contributions", label: "Contributions", class: "context", target: route(`${room}?tab=contributions`), score: 35 },
          { id: "approvals", label: "Approvals", class: "utility", target: route("/approvals"), score: 30, requires: "edit" },
          { id: "complete", label: "Complete or archive", class: "utility", target: route(`${room}/complete`), score: 20, requires: "edit" },
        ],
      };
    }

    case "crew":
      return {
        title: "This crew",
        items: [
          { id: "room", label: "Open Creative Room", icon: "room", class: "navigation", target: route(`/projects/${i.projectId}`), score: 90 },
          { id: "huddle", label: "Chat & Huddle", icon: "users", class: "collaboration", target: route(`/projects/${i.projectId}?tab=chat`), score: 85 },
          { id: "find", label: "Find People", icon: "people", class: "collaboration", target: route(`/discover?project=${i.projectId}`), score: 80, requires: "invite" },
          { id: "contributions", label: "Contributions", class: "context", target: route(`/projects/${i.projectId}?tab=contributions`), score: 50 },
        ],
      };

    case "huddles":
      return {
        title: "Huddles",
        items: [
          { id: "mine", label: "My Huddles", icon: "users", class: "context", target: route("/huddles?view=mine"), score: 90 },
          { id: "people", label: "Explore People", icon: "people", class: "collaboration", target: route("/discover"), score: 70 },
        ],
      };

    case "huddle":
      return {
        title: "This Huddle",
        items: i.artifactId
          ? [{ id: "open", label: "Open Creation", icon: "pen", class: "context", target: route(a), score: 90 }]
          : i.materialId
            ? [{ id: "open", label: "Open Material", icon: "images", class: "context", target: route(`/space/materials/${i.materialId}`), score: 90 }]
            : [],
      };

    case "huddle-summary":
      return {
        title: "After the Huddle",
        items: [
          { id: "create-from", label: "Create from this", icon: "spark", class: "create", target: route("/create"), score: 90 },
          { id: "people", label: "Continue with People", icon: "people", class: "collaboration", target: route("/messages"), score: 80 },
          { id: "another", label: "Start another Huddle", icon: "users", class: "collaboration", target: route("/huddles"), score: 40 },
        ],
      };

    case "me":
      return {
        title: "Me",
        items: [
          { id: "edit", label: "Edit Profile", icon: "user", class: "utility", target: route("/settings"), score: 90 },
          { id: "creations", label: "My Creations", icon: "pen", class: "navigation", target: route("/space?tab=progress"), score: 85 },
          { id: "collections", label: "Collections", icon: "images", class: "navigation", target: route("/space?tab=collections"), score: 80 },
          { id: "settings", label: "Settings", class: "utility", target: route("/settings?section=collaboration"), hint: "Collaboration, AI, privacy", score: 70 },
          { id: "brand", label: "Brand work", class: "utility", target: route("/settings?section=brand"), score: 30 },
        ],
      };

    case "creator":
      return {
        title: null,
        items: [
          { id: "people", label: "Explore People", icon: "people", class: "collaboration", target: route("/discover"), score: 70 },
          { id: "rooms", label: "Your Creative Rooms", icon: "room", class: "navigation", target: route("/projects"), score: 60 },
        ],
      };

    case "discover":
      return {
        title: "Find collaborators",
        items: [
          { id: "rooms", label: "Your Creative Rooms", icon: "room", class: "navigation", target: route("/projects"), score: 80 },
          { id: "huddle", label: "Start Huddle", icon: "users", class: "collaboration", target: route("/huddles"), score: 60 },
        ],
      };

    case "search":
    case "explore":
      return {
        title: "Explore",
        items: [
          { id: "create", label: "Create", icon: "spark", class: "create", target: cmd("create-menu"), score: 90 },
          { id: "save", label: "Save to Materials", icon: "add", class: "create", target: route("/send"), score: 85 },
          { id: "people", label: "People", icon: "people", class: "collaboration", target: route("/discover"), score: 80 },
        ],
      };

    case "approvals":
      return { title: "Approvals", items: [{ id: "autonomy", label: "Autonomy settings", class: "utility", target: route("/settings?section=autonomy"), score: 60 }] };

    case "approval":
      return {
        title: "This request",
        items: i.approvalArtifactId
          ? [
              { id: "creation", label: "Go to Creation", icon: "pen", class: "navigation", target: route(`/artifacts/${i.approvalArtifactId}`), score: 90 },
              { id: "context", label: "View Context", icon: "compass", class: "context", target: route(`/artifacts/${i.approvalArtifactId}/context`), score: 80 },
            ]
          : [],
      };

    case "publishing":
      return {
        title: "Publishing",
        items: [
          { id: "publish", label: "Publish a Creation", icon: "spark", class: "publish", target: route("/space?tab=created"), score: 90 },
          { id: "history", label: "Publication history", class: "context", target: route("/publishing"), score: 50 },
        ],
      };

    case "settings":
      // §9.56: Settings has its own navigation; the Palette only offers a way out.
      return {
        title: null,
        items: [
          { id: "home", label: "Home", icon: "home", class: "navigation", target: route("/"), score: 90 },
          { id: "me", label: "Me", icon: "user", class: "navigation", target: route("/profile"), score: 80 },
        ],
      };

    case "spaces":
      return {
        title: "My Creations",
        items: [
          { id: "new", label: "New Creation", icon: "spark", class: "create", target: route("/create"), score: 90 },
          ...(f.activeCreationId ? [{ id: "continue", label: "Continue", icon: "pen" as const, class: "create" as const, target: route(`/artifacts/${f.activeCreationId}`), score: 85 }] : []),
          { id: "explore", label: "Explore", icon: "compass", class: "navigation", target: route("/search"), score: 70 },
        ],
      };

    case "global":
    default:
      return { title: null, items: GLOBAL_ITEMS(ctx.pathname) };
  }
}

/** §7 / §9.12–9.15: what a Creation offers depends on where it is in its life, and on who's looking. */
function creationItems(ctx: PaletteContext, a: string): PaletteItem[] {
  const id = ctx.ids?.artifactId;
  const it = {
    continue: { id: "continue", label: "Continue Creating", icon: "pen", class: "create", target: route(`${a}/studio`), score: 100, requires: "edit" },
    bring: { id: "bring", label: "Bring Material", icon: "add", class: "create", target: route(`/create?artifact=${id}`), score: 90, requires: "edit" },
    refine: { id: "refine", label: "Refine", hint: "CreativeMind suggestions", icon: "spark", class: "transform", target: route(`${a}/studio#creativemind`), score: 85, requires: "edit" },
    people: { id: "people", label: "People", icon: "people", class: "collaboration", target: route(`${a}/collaborate`), score: 70, requires: "collaborate" },
    references: { id: "references", label: "References", class: "context", target: route(`${a}/context?tab=references`), score: 45 },
    transform: { id: "transform", label: "Transform", icon: "pen", class: "transform", target: route(`${a}/transform`), score: 44, requires: "edit" },
    versions: { id: "versions", label: "Versions", class: "context", target: route(`${a}?tab=versions`), score: 43 },
    visuals: {
      id: "visuals",
      label: "Visual directions",
      hint: "Images made from this Creation",
      icon: "images",
      class: "create",
      target: route(`${a}#visual-directions`),
      score: 46,
      requires: "edit",
    },
    context: { id: "context", label: "Context", hint: "Materials, people, related", icon: "compass", class: "context", target: route(`${a}/context`), score: 42 },
    share: { id: "share", label: "Share", class: "share", target: route(`${a}/share`), score: 40, requires: "publish" },
    rights: { id: "rights", label: "Rights", class: "rights", target: route(`${a}?tab=rights`), score: 35 },
    publish: { id: "publish", label: "Publish", class: "publish", target: route(`${a}/publish`), score: 30, requires: "publish" },
  } satisfies Record<string, PaletteItem>;
  const bump = (x: PaletteItem, score: number, label?: string): PaletteItem => ({ ...x, score, ...(label ? { label } : {}) });

  // Someone else's Creation: nothing that edits, publishes or changes rights.
  if (!ctx.permissions?.includes("edit")) return [bump(it.context, 90), bump(it.versions, 80), it.people, bump(it.rights, 60, "Rights & licensing")];

  switch (ctx.lifecycle) {
    case "idea":
      return [
        bump(it.bring, 100),
        { id: "explore", label: "Explore", icon: "compass", class: "create", target: route("/create/discover"), score: 95 },
        { id: "metalk", label: "meTalk", hint: "Say where it's going", icon: "mic", class: "create", target: cmd("metalk"), score: 90 },
        it.people,
        bump(it.continue, 40),
      ];
    case "review":
      return [
        { id: "review", label: "Review", hint: "Quality review", icon: "spark", class: "transform", target: route(`${a}/studio#creativemind`), score: 100, requires: "edit" },
        bump(it.refine, 95),
        { id: "compare", label: "Compare Versions", class: "context", target: route(`${a}/compare`), score: 90 },
        bump(it.people, 85),
        it.transform,
        it.share,
      ];
    case "finished":
      return [
        { id: "create-from", label: "Create from this", hint: "Trailer, carousel, post…", icon: "spark", class: "transform", target: route(`${a}/transform`), score: 100, requires: "edit" },
        bump(it.share, 95),
        bump(it.publish, 90),
        { id: "license", label: "License", class: "rights", target: route(`${a}?tab=rights`), score: 85, requires: "rights" },
        { id: "collaborate", label: "Collaborate", icon: "people", class: "collaboration", target: route(`${a}/collaborate`), score: 40, requires: "collaborate" },
        it.versions,
        it.context,
      ];
    case "published":
      return [
        bump(it.transform, 100),
        { id: "history", label: "Publication history", class: "publish", target: route("/publishing"), score: 95 },
        bump(it.share, 90),
        bump(it.rights, 85),
        { id: "derivative", label: "Create for a destination", class: "transform", target: route(`${a}/derivatives`), score: 40, requires: "edit" },
        it.versions,
        it.context,
      ];
    case "archived":
      return [bump(it.context, 90), bump(it.versions, 80), bump(it.rights, 60)];
    case "in-progress":
    default:
      return [it.continue, it.bring, it.refine, it.people, it.visuals, it.references, it.transform, it.versions, it.context, it.share, it.rights, it.publish];
  }
}
