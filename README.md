# Wonder Creator

> **Bring something. Let's see what it can become.**

Wonder Creator is an AI-native creative studio for artists and creators. Bring a thought, a photo, a voice note or a
link; CreatorBrain understands it, suggests what it could become, and helps you make it — in your voice, with your
rights, versions and lineage kept. Creators can also meet in **Huddles**: live, spontaneous conversations that
dissolve when the last person leaves.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix UI, Lucide |
| Data | Supabase (Postgres + RLS, Auth, Storage, Realtime) |
| AI | Anthropic Claude via the official `@anthropic-ai/sdk`, behind a provider-neutral interface |
| Realtime media | LiveKit (SFU) via a provider-neutral interface — optional |
| Tests | Vitest (unit + database security), Playwright (E2E) |
| Hosting | Vercel (app, cron) + Supabase |

## Repository layout

```
apps/web                    Next.js app: pages, /api/v1 route handlers, UI composition
packages/core               errors, events, audit, privacy classes, SSRF guard, upload validation, rate limiting
packages/db                 generated Supabase types
packages/ui                 design system: brand tokens, components, supplied brand assets (see brand/ASSETS.md)
packages/creator-identity   profile, creative voice, boundaries, autonomy policy
packages/creator-library    Creative Material, provenance, collections, Reference Shelf
packages/creator-send       CreatorSend intake pipeline (validate → store → extract → understand)
packages/creator-talk       CreatorTalk conversations and turn routing
packages/creator-brain      CreatorBrain: providers, context, intent, governance, pipeline, quality, memory
packages/creator-studio     Artifacts, immutable versions, lineage graph, rights foundation, export
packages/creator-huddle     Huddle lifecycle services, presence helpers, media provider abstraction
supabase/migrations         schema, RLS policies, security-definer RPCs
tests/db                    RLS / authorization test suite against a real Supabase stack
e2e                         Playwright end-to-end tests
docs                        architecture, security, decisions, progress
```

## Getting started

Requirements: Node 22+, Docker (for the local Supabase stack).

```bash
npm install
npx supabase start                      # local Postgres, Auth, Storage, Realtime
npx supabase status -o env              # copy values into apps/web/.env.local (see .env.example)
npm run dev                             # http://localhost:3000
```

Without `ANTHROPIC_API_KEY`, development uses the **offline development model**: deterministic placeholder drafts,
clearly labelled in the UI. It never pretends to be real AI. In production without a key, CreatorBrain reports
itself as not connected.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint (whole monorepo) |
| `npm run typecheck` | Route types + `tsc` for packages and the app |
| `npm test` | Unit tests (Vitest) |
| `npm run test:db` | Database security tests (needs `supabase start`) |
| `npm run test:e2e` | Playwright E2E (needs the app running on :3000) |
| `npm run db:reset` | Re-apply migrations locally |
| `npm run db:types` | Regenerate `packages/db/src/database.types.ts` |

## Configuration

See `.env.example`. Server-only secrets (`SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `LIVEKIT_API_SECRET`,
`CRON_SECRET`) are never exposed to the browser.

## Deploying

1. Create a Supabase project and run `npx supabase db push` (migrations in `supabase/migrations`).
2. Import the repo in Vercel with **Root Directory = `apps/web`**.
3. Set env vars from `.env.example`. `CRON_SECRET` protects `/api/v1/jobs/run` (Vercel Cron sends it automatically).
   The bundled cron runs daily (Hobby-compatible); on Pro, schedule it every 5 minutes.
4. Optional: set `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` for Huddle voice and video.

More: [architecture](docs/architecture.md) · [security](docs/security.md) · [decisions](docs/decisions.md) ·
[P0 progress](docs/progress.md) · [brand assets](packages/ui/src/brand/ASSETS.md)
