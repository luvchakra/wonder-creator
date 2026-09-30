# Decisions

1. **Anthropic SDK instead of Vercel AI SDK.** The build contract listed the Vercel AI SDK; the official
   `@anthropic-ai/sdk` is used behind `CreativeModelProvider` so Claude-specific features (adaptive thinking, effort,
   structured outputs, server-side refusal fallback) are first-class. Other providers (Gemini, OpenAI) can be added
   as adapters of the same interface.
2. **Provider chosen by environment.** `WONDERCREATOR_AI_PROVIDER` selects `gemini` (Generative Language REST API,
   default `gemini-3.8-flash`, thinking level per task, `responseJsonSchema` structured output) or `anthropic`
   (default `claude-opus-5`); the key is `WONDERCREATOR_AI_API_KEY` and `WONDERCREATOR_AI_MODEL` overrides the model.
   Gemini is called over REST (no extra SDK), with the key in the `x-goog-api-key` header so it never appears in URLs.
3. **Offline provider** for development/CI only (deterministic, labelled). Production without a key is "not connected".
4. **LiveKit** as the first `RealtimeMediaProvider` adapter (SFU; no browser mesh).
5. **Supabase Realtime + polling** for Huddle presence; the UI tolerates stale presence.
6. **Durable work**: `after()` for immediacy + `jobs` table + cron worker for retries.
7. **Brand assets**: pixel crops of the supplied board and background set (see `packages/ui/src/brand/ASSETS.md`);
   vector originals are an outstanding asset dependency.
8. **One tenant per creator** in P0 (personal tenants); team tenants are modelled but not surfaced.
9. **Settings shown only where implemented** (no fake Billing/Integrations/Notifications panels).
10. **Semantic search = pgvector + provider embeddings, owner-scoped.** `gemini-embedding-2` at 768 dimensions
   (fixed: vectors only compare within one model). Only the creator's own active, clean materials and non-archived
   artifacts are embedded; rows are written by the server pipeline and readable only by their owner. Indexing is
   incremental (stale = missing or older than the subject; unchanged content is re-stamped, not re-embedded) and runs
   after intake, after edits (`withApi({ reindex: true })`) and in the cron backfill. Keyword results stay first;
   meaning-based matches are appended and labelled. Without an embedding provider, search is lexical only.
11. **Aesthetic excellence over plainness (owner, 30 Sep 2026).** "Change any rules that need to be changed to achieve
   aesthetic excellence." The owner's boards are the visual target (art, colour, type, spacing, mood), not a loose
   reference; plan guardrails still win on privacy, rights and popularity metrics. Screens are split into expressive
   (Home, onboarding, Profile, Creator Page, published works, DejaVu, Moments, empty states, sign-in) and utility
   surfaces; the compact-density numbers apply fully to utility surfaces and act only as clutter ceilings on
   expressive ones. Decorative art may be authored in code when nothing supplied fits (provenance in `ASSETS.md`); the
   logo, wordmark, app icon and supplied art are never altered. Accessibility never bends. UI isn't done until it has
   been compared with its board at phone and desktop widths. See CLAUDE.md → Aesthetic excellence.
