# Architecture

One Next.js application, one Supabase project, domain packages, event records. No microservices.

```
Browser ──► Next.js (apps/web)
              ├─ Server Components (reads, RLS-scoped Supabase client with the creator's session)
              ├─ /api/v1 route handlers (mutations) ── withApi: auth → creator → rate limit → zod → service → event
              ├─ proxy.ts (session refresh)
              └─ /api/v1/jobs/run (cron worker, service role, CRON_SECRET)
                         │
       domain packages   ▼
       creator-identity · creator-library · creator-send · creator-talk · creator-brain · creator-studio · creator-huddle
                         │
                         ▼
   Supabase: Postgres (RLS + security-definer RPCs) · Auth · Storage (private bucket, signed URLs) · Realtime
                         │
   Providers:  Anthropic Claude (CreativeModelProvider)   LiveKit SFU (RealtimeMediaProvider)
```

## Core loop

`Creator → CreatorSend (intake) → Creative Material → CreatorBrain (understand → discover) → Create → Artifact
→ Refine / Transform (new versions, derivatives with lineage) → Preserve / Share → Creative Memory → future context`

## CreatorBrain

- **Providers** (`providers/`): `AnthropicProvider` (official SDK, streaming, adaptive thinking, structured outputs,
  server-side refusal fallback), `OfflineProvider` (deterministic, dev/test only, labelled), `UnavailableProvider`.
- **Context** (`context.ts`): `CreativeContext` assembled per intent with minimisation (only what the task needs);
  privacy classes enforced before retrieval; materials referenced by short refs (m1, m2) — the model never sees or
  invents database IDs.
- **Intent** (`intent.ts`): deterministic routing; ambiguous references ("make that darker") produce one focused question.
- **Governance** (`governance.ts`): governed tools with autonomy domains; decisions recorded in `ai_tool_calls`;
  consequential actions become proposals (What I understood / What I plan to do / Impact → Confirm · Change · Cancel).
- **Pipeline** (`pipeline.ts`): understand → research → plan → generate → critique → validate → render, each step
  recorded in `ai_run_steps`; AI runs record model, tokens, latency, estimated cost — never raw prompts.
- **Memory** (`memory.ts`): editable, removable, explainable; corrections ("That's not how I write") replace the
  responsible memories with the creator's words.

## CreatorSend

States: `received → validating → security_review → extracting → normalizing → understood → ready` (+ `failed`,
`quarantined`). Originals are validated (content-detected MIME, per-kind size limits, SHA-256) and stored before any
processing; processing failures never delete them. Extraction: text, PDF (unpdf), web pages (SSRF-guarded fetch),
YouTube (oEmbed). Audio/video transcription is not connected (honest note in the UI). Work continues via `after()`
with a durable `jobs` row as the fallback for the cron worker.

## Huddle

Control plane in Postgres: `huddle_start / request_join / resolve_request / enter / leave / heartbeat /
remove_participant / end` security-definer RPCs enforce the authorization matrix. Dissolution at zero joined
participants deletes chat, participants and requests; relationship signals (`creator_relationships`) survive;
moderation reports survive. Public discovery uses `live_huddle_cards()` (safe metadata only). Presence: heartbeat
every 25 s, stale after 90 s (throttled sweep + cron). Media plane: LiveKit tokens are issued only to joined
participants; audio/video never pass through app servers. Without LiveKit, rooms are text-only and say so.

## Data model highlights

`tenants`, `creators` (+ normalised facets), `creator_voice_profiles`, `creator_boundaries`,
`creator_autonomy_policies`, `provenance_records`, `creative_materials`, `intake_items`, `reference_*`,
`conversations`, `ai_runs`/`ai_run_steps`/`ai_tool_calls`/`ai_proposals`, `creative_memories`, `artifacts`,
`artifact_versions` (immutable), `lineage_edges`, `quality_reports`, `rights_records`/`rights_owners`/`licenses`/
`rights_events`, `huddles`/`huddle_*`, `moderation_reports`, `domain_events` (immutable), `audit_logs` (immutable),
`jobs`, `storage_objects`.
