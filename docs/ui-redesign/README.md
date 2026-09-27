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
| UI-A | Materials wall · Material detail | Not started |
| UI-A | Creation view · Creative Studio · Context view | Not started |
| UI-A | Presentation terminology sweep | Not started |
| UI-B | Transform · Quality · Versions · Rights · Share/Publish · Approval Center | Not started |
| UI-C | Creative Room · Crew · Invitations · Tasks · Collaborative editing · Contributions · Find collaborators · Huddles | Not started |
| UI-D | Autonomy · Privacy · CreatorPublish · Brand · Campaign · Commercial rights · Market · Business · Analytics | Not started |

## Asset dependencies

See `packages/ui/src/brand/ASSETS.md` → Missing assets (Palette motif; composable botanical corners and washes).
