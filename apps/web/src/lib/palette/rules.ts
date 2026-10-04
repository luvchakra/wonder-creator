import { CRAFT_LABEL } from "@wonder/creator-studio/craft";
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
    hint: "Writing, Carousel, Images or Audio — or make it with others",
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
    target: route("/materials?tab=ideas"),
    score: 58,
    current: pathname.startsWith("/materials"),
  },
  {
    id: "explore",
    label: "Explore",
    hint: "Ideas, People, Pulse and Huddles",
    icon: "compass",
    class: "navigation",
    target: route("/explore"),
    score: 56,
    current: pathname.startsWith("/explore") || pathname.startsWith("/people") || pathname.startsWith("/pulse") || pathname.startsWith("/huddles"),
  },
  {
    id: "me",
    label: "Me",
    hint: "Your profile, Creations and settings",
    icon: "user",
    class: "navigation",
    target: route("/me"),
    score: 55,
    current: pathname.startsWith("/me") || pathname.startsWith("/creators"),
  },
];

type Rules = { title: string | null; items: PaletteItem[] };

export function rulesFor(ctx: PaletteContext): Rules {
  const i = ctx.ids ?? {};
  const f = ctx.facts ?? {};
  const a = i.artifactId ? `/creations/${i.artifactId}` : "";
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
          { id: "collections", label: "Collections", icon: "images", class: "context", target: route("/materials?tab=collections"), score: 80 },
          { id: "explore", label: "Explore", icon: "compass", class: "navigation", target: route("/explore"), score: 70 },
        ],
      };

    case "material": {
      const m = i.materialId!;
      const create: PaletteItem = { id: "create-with", label: "Create with this", icon: "spark", class: "create", target: route(`/create?material=${m}`), score: 100 };
      const related: PaletteItem[] = f.related
        ? [{ id: "related", label: "Find related", icon: "search", class: "context", target: route(`/explore?q=${encodeURIComponent(f.related)}`), score: 85 }]
        : [];
      const collect: PaletteItem = { id: "collect", label: "Add to Collection", icon: "images", class: "context", target: route(`/materials/${m}#collections`), score: 80 };
      const explore: PaletteItem = { id: "explore", label: "Explore possibilities", icon: "compass", class: "create", target: route(`/create/discover?material=${m}`), score: 75 };
      const edit: PaletteItem = { id: "edit", label: "Edit details", class: "utility", target: route(`/materials/${m}#details`), score: 30, requires: "edit" };
      const byKind: PaletteItem[] =
        ctx.entityType === "audio"
          ? [{ id: "words", label: "Use the words", hint: "The transcript", icon: "mic", class: "create", target: route(`/materials/${m}#transcript`), score: 90 }]
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
          ...(f.name ? [{ id: "related", label: "Explore related", icon: "search" as const, class: "context" as const, target: route(`/explore?q=${encodeURIComponent(f.name)}`), score: 80 }] : []),
        ],
      };

    case "creation":
      return { title: "This Creation", items: creationItems(ctx, a) };

    case "studio":
      // The Writing page (owner, 4 Oct 2026: "less about AI, more about supporting the writing type"): that kind's own
      // tools lead — lines and stanzas for a poem, headline and lede for news, scenes and runtime for a script — then
      // hearing it read, then publishing. Preview and Cover are on the page itself, so they aren't repeated here.
      if (f.writingStyle && f.workPath) {
        const craft = CRAFT_LABEL[f.writingStyle];
        return {
          title: "This Creation",
          items: [
            { id: "craft", label: craft.label, hint: craft.hint, icon: "pen", class: "context", target: route(`${f.workPath}#craft`), score: 125 },
            { id: "aloud", label: "Hear it read", hint: f.writingStyle === "verse" ? "Read aloud — listen for the rhythm and the breaks" : "Read aloud by your device, to catch what the eye skips", icon: "mic", class: "context", target: route(`${f.workPath}#aloud`), score: 115 },
            ...(f.hasWords
              ? [{ id: "publish-link", label: f.published ? "On my Creator Page" : "Publish as link", hint: f.published ? "Show it on your public page, or not" : "A page of its own — only people with the link", icon: "spark" as const, class: "share" as const, target: route(`${a}/publish`), score: 110, requires: "publish" as const }]
              : []),
            { id: "share", label: "Share", hint: "A private link for people you choose", class: "share", target: route(`${a}/share`), score: 90, requires: "publish" },
            { id: "versions", label: "Versions", hint: "Every saved version — compare or restore one", class: "context", target: route(`${a}?tab=versions`), score: 85 },
            { id: "people", label: "People", hint: "Who's working on it and what each person may do", icon: "people", class: "collaboration", target: route(`${a}/collaborate`), score: 80, requires: "collaborate" },
            { id: "transform", label: "Change format", hint: "Make a carousel, audio or a post from it", icon: "pen", class: "transform", target: route(`${a}/transform`), score: 70, requires: "edit" },
          ],
        };
      }
      // §9.16–9.19: the canvas stays dominant; editor controls stay in the editor. Materials, References and Context
      // live in the Studio's Working Set now (creative-studio-working-set.md §66), and Refine is on the page itself.
      // Once there are saved words, what's next leads (owner, 4 Oct 2026): Preview, Publish, Share; after publishing,
      // the link and the Creator Page.
      return {
        title: "This Creation",
        items: [
          ...(f.hasWords
            ? [
                { id: "preview", label: f.published ? "Preview & link" : "Preview", hint: f.published ? "Your page as readers see it, with the link" : "See it as readers would, then publish", icon: "images" as const, class: "share" as const, target: route(`${a}/preview`), score: 120, requires: "publish" as const },
                { id: "publish-link", label: f.published ? "On my Creator Page" : "Publish as link", hint: f.published ? "Show it on your public page, or not" : "A page of its own — only people with the link", icon: "spark" as const, class: "share" as const, target: route(`${a}/publish`), score: 110, requires: "publish" as const },
              ]
            : []),
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
          { id: "share", label: "Share", hint: "A private link for people you choose", class: "share", target: route(`${a}/share`), score: f.hasWords ? 105 : 40, requires: "publish" },
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
      const room = `/rooms/${i.projectId}`;
      const active = f.activeCreationId;
      return {
        title: "This Creative Room",
        items: [
          active
            ? { id: "studio", label: "Open Studio", icon: "pen", class: "create", target: route(`/creations/${active}/studio`), score: 100, requires: "edit" }
            : { id: "start", label: "Start Creation", icon: "spark", class: "create", target: route(`/create?project=${i.projectId}`), score: 100, requires: "edit" },
          { id: "bring", label: "Bring Material", icon: "add", class: "create", target: route("/send"), score: 90 },
          f.hasCrew && i.crewId
            ? { id: "people", label: "People", icon: "people", class: "collaboration", target: route(`/crews/${i.crewId}`), score: 80 }
            : { id: "invite", label: "Invite People", icon: "people", class: "collaboration", target: route(`/people?project=${i.projectId}`), score: 80, requires: "invite" },
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
          { id: "room", label: "Open Creative Room", icon: "room", class: "navigation", target: route(`/rooms/${i.projectId}`), score: 90 },
          { id: "huddle", label: "Chat & Huddle", icon: "users", class: "collaboration", target: route(`/rooms/${i.projectId}?tab=chat`), score: 85 },
          { id: "find", label: "Find People", icon: "people", class: "collaboration", target: route(`/people?project=${i.projectId}`), score: 80, requires: "invite" },
          { id: "contributions", label: "Contributions", class: "context", target: route(`/rooms/${i.projectId}?tab=contributions`), score: 50 },
        ],
      };

    case "huddles":
      return {
        title: "Huddles",
        items: [
          { id: "mine", label: "My Huddles", icon: "users", class: "context", target: route("/huddles?view=mine"), score: 90 },
          { id: "people", label: "Explore People", icon: "people", class: "collaboration", target: route("/people"), score: 70 },
        ],
      };

    case "huddle":
      return {
        title: "This Huddle",
        items: i.artifactId
          ? [{ id: "open", label: "Open Creation", icon: "pen", class: "context", target: route(a), score: 90 }]
          : i.materialId
            ? [{ id: "open", label: "Open Material", icon: "images", class: "context", target: route(`/materials/${i.materialId}`), score: 90 }]
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
          { id: "creations", label: "My Creations", icon: "pen", class: "navigation", target: route("/materials?tab=progress"), score: 85 },
          { id: "collections", label: "Collections", icon: "images", class: "navigation", target: route("/materials?tab=collections"), score: 80 },
          { id: "settings", label: "Settings", class: "utility", target: route("/settings?section=collaboration"), hint: "Collaboration, AI, privacy", score: 70 },
          { id: "brand", label: "Brand work", class: "utility", target: route("/settings?section=brand"), score: 30 },
        ],
      };

    case "creator":
      return {
        title: null,
        items: [
          // Testimonials (docs/testimonials.md): offered only when the server would accept one.
          ...(f.canWrite && i.creatorHandle ? [{ id: "testimonial", label: "Write a testimonial", icon: "pen" as const, class: "collaboration" as const, target: route(`/creators/${i.creatorHandle}?write=testimonial`), score: 80 }] : []),
          { id: "people", label: "Explore People", icon: "people", class: "collaboration", target: route("/people"), score: 70 },
          { id: "rooms", label: "Your Creative Rooms", icon: "room", class: "navigation", target: route("/rooms"), score: 60 },
        ],
      };

    case "discover":
      return {
        title: "Find collaborators",
        items: [
          { id: "rooms", label: "Your Creative Rooms", icon: "room", class: "navigation", target: route("/rooms"), score: 80 },
          { id: "huddle", label: "Start Huddle", icon: "users", class: "collaboration", target: route("/huddles"), score: 60 },
        ],
      };

    // A Community (docs/communities.md): members start topics and share their work; everyone can see who's in it.
    case "community": {
      // Start a topic is the page's own primary action, and Forum/Huddles/Members are its visible views, so the Palette
      // offers what's next beyond them (interaction-minimalism: don't duplicate the page's controls).
      const room = `/rooms/${i.projectId}`;
      return {
        title: "This community",
        items: f.member
          ? [
              { id: "share", label: "Share a Creation here", icon: "add", class: "share", target: route(`${room}?tab=work`), score: 100 },
              { id: "huddle", label: "Chat & Huddle", icon: "users", class: "collaboration", target: route(`${room}?tab=chat`), score: 90 },
              { id: "room", label: "Open Creative Room", icon: "room", class: "navigation", target: route(room), score: 80 },
              { id: "all", label: "All communities", icon: "compass", class: "navigation", target: route("/pulse?filter=communities"), score: 70 },
            ]
          : [
              { id: "all", label: "All communities", icon: "compass", class: "navigation", target: route("/pulse?filter=communities"), score: 80 },
              { id: "community", label: "Pulse", icon: "people", class: "navigation", target: route("/pulse"), score: 70 },
            ],
      };
    }

    case "search":
    case "explore":
      return {
        title: "Explore",
        items: [
          { id: "create", label: "Create", icon: "spark", class: "create", target: cmd("create-menu"), score: 90 },
          { id: "save", label: "Save to Materials", icon: "add", class: "create", target: route("/send"), score: 85 },
          { id: "people", label: "People", icon: "people", class: "collaboration", target: route("/people"), score: 80 },
        ],
      };

    case "approvals":
      return { title: "Approvals", items: [{ id: "autonomy", label: "Autonomy settings", class: "utility", target: route("/settings?section=autonomy"), score: 60 }] };

    case "approval":
      return {
        title: "This request",
        items: i.approvalArtifactId
          ? [
              { id: "creation", label: "Go to Creation", icon: "pen", class: "navigation", target: route(`/creations/${i.approvalArtifactId}`), score: 90 },
              { id: "context", label: "View Context", icon: "compass", class: "context", target: route(`/creations/${i.approvalArtifactId}/context`), score: 80 },
            ]
          : [],
      };

    case "publishing":
      return {
        title: "Publishing",
        items: [
          { id: "publish", label: "Publish a Creation", icon: "spark", class: "publish", target: route("/materials?tab=created"), score: 90 },
          { id: "history", label: "Publication history", class: "context", target: route("/publishing"), score: 50 },
        ],
      };

    case "settings":
      // §9.56: Settings has its own navigation; the Palette only offers a way out.
      return {
        title: null,
        items: [
          { id: "home", label: "Home", icon: "home", class: "navigation", target: route("/"), score: 90 },
          { id: "me", label: "Me", icon: "user", class: "navigation", target: route("/me"), score: 80 },
        ],
      };

    case "spaces":
      return {
        title: "My Creations",
        items: [
          { id: "new", label: "New Creation", icon: "spark", class: "create", target: route("/create"), score: 90 },
          ...(f.activeCreationId ? [{ id: "continue", label: "Continue", icon: "pen" as const, class: "create" as const, target: route(`/creations/${f.activeCreationId}`), score: 85 }] : []),
          { id: "explore", label: "Explore", icon: "compass", class: "navigation", target: route("/explore"), score: 70 },
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
  const work = ctx.facts?.workPath ?? `${a}/studio`;
  const it = {
    continue: { id: "continue", label: "Continue Creating", icon: "pen", class: "create", target: route(work), score: 100, requires: "edit" },
    bring: { id: "bring", label: "Bring Material", icon: "add", class: "create", target: route(`/create?artifact=${id}`), score: 90, requires: "edit" },
    refine: { id: "refine", label: "Refine", hint: "CreativeMind suggestions", icon: "spark", class: "transform", target: route(`${work}#creativemind`), score: 85, requires: "edit" },
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
        { id: "review", label: "Review", hint: "Quality review", icon: "spark", class: "transform", target: route(`${work}#creativemind`), score: 100, requires: "edit" },
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
