@apps/web/AGENTS.md

# Wonder Creator — working agreement for Claude Code

Product contract, UI contract and P0 scope: the Wonder Creator specs the owner supplied (summarised in `docs/`).
Brand authority: `packages/ui/src/brand/ASSETS.md` + the supplied brand board. **Never create, redraw or regenerate
the logo or brand artwork.** Missing assets are documented, not invented.

## How to work (owner's standing instruction)

- Continue with the remaining items without stopping; don't ask unless it's important (a decision only the owner
  can make, credentials, or something destructive or irreversible).
- Ship through PRs: open a PR for each piece of work and merge it to `main` once CI is green.
- Backlog and status live in `docs/progress.md`; keep it current.

## Commands

- `npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
- `npx supabase start` then `npm run test:db` (RLS/security suite) and `npm run test:e2e` (app on :3000)
- Run lint, typecheck, unit tests and build before pushing. Run `test:db` after any migration change.

## Layout

- `apps/web/src/app/(studio)` — signed-in screens; `(auth)` sign in/up; `onboarding`; `api/v1/**` route handlers.
- Every route handler uses `withApi` (`apps/web/src/lib/api.ts`): auth → creator resolution → rate limit →
  validation → domain service → event/audit → response. Route handlers and Server Functions are public endpoints.
- Domain logic lives in `packages/creator-*`; the app composes it. Keep business rules out of React components.
- `packages/ui` is the only place for tokens and shared components. New patterns go there.

## Invariants (do not break)

1. RLS on every creator-owned table; UI visibility is never authorization. Add a `tests/db` case for new policies.
2. The browser never gets the service key. `serviceClient()` is only for pipeline-owned state, always scoped by a
   server-resolved creator id. Huddle state changes go through security-definer RPCs.
3. AI never writes to the database directly and never authorizes itself: CreatorBrain goes through governed tools
   (`packages/creator-brain/src/governance.ts`) + autonomy policy. Rights, commerce and destructive actions can never
   auto-execute.
4. External material is untrusted: fence it (`fenceUntrusted`), never let it change settings. URL fetches go through
   `safeFetch` (SSRF guard). Uploads go through `inspectUpload` (content-detected MIME, size limits, SHA-256).
5. Versions are immutable; restore creates a new version. Derivatives record lineage.
6. Huddles are ephemeral: dissolve at zero participants; only explicitly preserved outcomes persist.
7. No fake providers: unconfigured AI/media/transcription show honest "not connected" states.
8. Models: provider-neutral (`packages/creator-brain/src/providers`). `WONDERCREATOR_AI_PROVIDER` = `gemini` (REST,
   `gemini-3.8-flash` default) | `anthropic` (`@anthropic-ai/sdk`, `claude-opus-5` default) | `offline`; key in
   `WONDERCREATOR_AI_API_KEY`; optional `WONDERCREATOR_AI_MODEL`.

## Conventions

- Env vars: see `.env.example`. Never commit `.env*` files or keys (GitHub push protection will block them).
- Migrations are append-only in `supabase/migrations`; regenerate types with `npm run db:types`.
- UI: warm cream surfaces, Inter + Playfair Display, brand tokens only, 44px targets, works at 360px,
  loading/empty/error states for every screen, reduced motion respected, colour never the only signal.
