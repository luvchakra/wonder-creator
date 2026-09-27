# UI redesign — tracker

Spec: [`spec.md`](spec.md) (owner-supplied, 27 Sep 2026). Boards: [`boards/`](boards) — visual references only.

## Presentation language (UI copy only — internal names stay)

| Internal (code, DB, API) | UI |
|---|---|
| artifact | **Creation** |
| artifact studio (`/artifacts/[id]/studio`) | **Creative Studio** |
| creator-brain / CreatorBrain | **CreativeMind** |
| CreatorTalk (`/create`) | **meTalk** |
| project (`/projects/[id]`) | **Creative Room** |
| app navigation | **Palette** (Creative Palette) |
| CreatorSend (`/send`) | **Bring Material** |

## Phases (spec §54)

| Phase | Item | Status |
|---|---|---|
| UI-A | Canvas shell + Creative Palette (no bottom nav, slim top bar, contextual Creation / Creative Room / Material palettes) | Done |
| UI-A | Home Canvas (greeting, one current Creation, one honest CreativeMind moment, recent Materials, one live Huddle) + meTalk sheet | Done |
| UI-A | Materials wall · Material detail | Done |
| UI-A | Supplied watercolor artwork: Palette trigger motif, one Home floral corner; responsive AVIF/WebP, hashed, immutable, typed registry (`WATERCOLOR`), only the motif and the one Home decoration are preloaded | Done |
| UI-A | Creation view (hero, type/status, description, key metadata, four sections, one CreativeMind insight) · Context view (Materials · References · People · Related; old `?tab=lineage/references` links redirect) | Done |
| UI-A | Creative Studio — writing canvas: near-full-screen surface at reading measure, minimal title/status, no AI pane (CreativeMind as refine chips, one ask line and the quality review below the page), Creation Palette (§7.3) while working. Creations are text today; video/image/audio canvases wait for media Creations (no fake editors) | Done |
| UI-A | Presentation terminology sweep — user-visible copy only: piece/artifact → Creation, project → Creative Room, Studio → Creative Studio, CreatorBrain → CreativeMind, CreatorTalk → meTalk (identifiers, routes, tables, events and AI-only prompt text unchanged) | Done |
| UI-B | Transform Creation (`/artifacts/:id/transform`): format cards filtered by the source (forms that suit it first, every other form by category), each with a shape preview, format, one sentence and output shape; tap → focused configuration (version, notes, what carries over) → Create a new Creation with lineage | Done |
| UI-B | Transform · Quality · Versions · Rights · Share/Publish · Approval Center | Not started |
| UI-C | Creative Room · Crew · Invitations · Tasks · Collaborative editing · Contributions · Find collaborators · Huddles | Not started |
| UI-D | Autonomy · Privacy · CreatorPublish · Brand · Campaign · Commercial rights · Market · Business · Analytics | Not started |

## Asset dependencies

See `packages/ui/src/brand/ASSETS.md` → Missing assets (Palette motif; composable botanical corners and washes).
