# Decisions

1. **Anthropic SDK instead of Vercel AI SDK.** The build contract listed the Vercel AI SDK; the official
   `@anthropic-ai/sdk` is used behind `CreativeModelProvider` so Claude-specific features (adaptive thinking, effort,
   structured outputs, server-side refusal fallback) are first-class. Other providers (Gemini, OpenAI) can be added
   as adapters of the same interface.
2. **Default model `claude-opus-5`**, overridable with `WONDER_AI_MODEL`.
3. **Offline provider** for development/CI only (deterministic, labelled). Production without a key is "not connected".
4. **LiveKit** as the first `RealtimeMediaProvider` adapter (SFU; no browser mesh).
5. **Supabase Realtime + polling** for Huddle presence; the UI tolerates stale presence.
6. **Durable work**: `after()` for immediacy + `jobs` table + cron worker for retries.
7. **Brand assets**: pixel crops of the supplied board and background set (see `packages/ui/src/brand/ASSETS.md`);
   vector originals are an outstanding asset dependency.
8. **One tenant per creator** in P0 (personal tenants); team tenants are modelled but not surfaced.
9. **Settings shown only where implemented** (no fake Billing/Integrations/Notifications panels).
