import { DomainError, fromDbError, isDomainError, log, must } from "@wonder/core";
import type { Db, JsonValue, Tables } from "@wonder/db";
import { z } from "zod";
import { findCollaborators, stemTerm, type CollaboratorCard } from "@wonder/creator-identity";
import { artifactType, createArtifact, createVersion, getArtifact, getPublishingPreferences, inheritFromSource, isKnownArtifactType, listDestinations, type LineageSource } from "@wonder/creator-studio";
import { renderBrief, type IntentBrief } from "./clarify";
import { artifactSourceMaterials, findingsOf, getReport, markApplied, provenanceCheck, selectiveInstruction, withRightsCheck } from "./quality-workflow";
import { assembleContext, extractKeywords, type CreativeContext, type MaterialContext } from "./context";
import { authorizeTool, claimProposal, createProposal, getPendingProposal, resolveProposal, type Proposal } from "./governance";
import { artifactBrief, renderMaterials, systemPrompt, TASKS } from "./prompts";
import { fenceUntrusted } from "@wonder/core/server";
import type { ContentPart, CreativeModelProvider, GenerateInput } from "./providers/types";
import { heuristicChecks, mergeChecks, type QualityCheck } from "./quality";
import { RunTracker, type StepName } from "./runs";
import { critiqueSchema, directionsSchema, planSchema, understandingSchema, type Direction, type Intent, type Understanding } from "./schemas";


export interface ProgressEvent {
  step: StepName | "deciding";
  label: string;
}

export interface BrainDeps {
  db: Db;
  creatorId: string;
  provider: CreativeModelProvider;
  /** Loads an image the creator owns, for vision. Returns null if unavailable. */
  loadImage?: (storageObjectId: string) => Promise<{ mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; dataBase64: string } | null>;
  onProgress?: (e: ProgressEvent) => void;
  /** Called once a run is recorded, so the caller can link to its progress (the run page survives navigation). */
  onRunStarted?: (runId: string, intent: string) => void;
  correlationId?: string;
}

const STEP_LABEL: Record<StepName, string> = {
  understand: "Understanding your material",
  research: "Gathering references",
  plan: "Planning the piece",
  generate: "Creating",
  critique: "Checking quality",
  refine: "Refining",
  validate: "Validating",
  render: "Saving a new version",
};

function progress(deps: BrainDeps, step: StepName) {
  deps.onProgress?.({ step, label: STEP_LABEL[step] });
}

function hintsFrom(ctx: CreativeContext, extra: GenerateInput["hints"] = {}): GenerateInput["hints"] {
  const text = [ctx.currentIntent.instruction, ...ctx.selectedMaterials.map((m) => `${m.title} ${m.text.slice(0, 500)}`)].join(" ");
  return { keywords: extractKeywords(text), refs: ctx.selectedMaterials.map((m) => m.ref), ...extra };
}

async function materialParts(deps: BrainDeps, materials: MaterialContext[]): Promise<ContentPart[]> {
  const parts: ContentPart[] = [{ type: "text", text: `Attached material:\n\n${renderMaterials(materials)}` }];
  if (!deps.provider.live || !deps.loadImage) return parts;
  for (const m of materials.filter((x) => x.imageObjectId).slice(0, 6)) {
    const img = await deps.loadImage(m.imageObjectId!).catch(() => null);
    if (img) parts.push({ type: "text", text: `Image for [${m.ref}] ${m.title}:` }, { type: "image", ...img });
  }
  return parts;
}

async function runGuarded<T>(run: RunTracker, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    await run.fail(isDomainError(e) ? e.code : "internal").catch(() => undefined);
    if (!isDomainError(e)) log("error", "brain.run_failed", { runId: run.id, error: String(e) });
    throw e;
  }
}

async function startRun(
  deps: BrainDeps,
  intent: string,
  opts: { conversationId?: string | null; artifactId?: string | null; inputCategory?: string; intentBrief?: Record<string, unknown> | null; request?: Record<string, unknown> | null; retryOf?: string | null },
) {
  const run = await RunTracker.start(deps.db, deps.creatorId, {
    intent,
    provider: deps.provider.name,
    model: deps.provider.modelFor("generate"),
    conversationId: opts.conversationId,
    artifactId: opts.artifactId,
    inputCategory: opts.inputCategory,
    correlationId: deps.correlationId,
    intentBrief: opts.intentBrief,
    request: opts.request,
    retryOf: opts.retryOf,
  });
  deps.onRunStarted?.(run.id, intent);
  return run;
}

/** A working title from the creator's words ("a short film about my father's life" → "My Father's Life"). */
export function titleFromInstruction(instruction: string): string | null {
  const m = instruction.match(/\babout\s+(.{3,60}?)(?:[.,;:!?]|\s+(?:and|with|using|from)\s|$)/i);
  if (!m) return null;
  const t = m[1].trim().replace(/^(the|a|an)\s+/i, "");
  return t.replace(/(^|\s)(\p{Ll})/gu, (_, sp, c) => sp + c.toUpperCase()).slice(0, 80) || null;
}

// ---------------------------------------------------------------------------
// Understand + Discover
// ---------------------------------------------------------------------------
export async function understand(deps: BrainDeps, ctx: CreativeContext, run: RunTracker): Promise<Understanding> {
  progress(deps, "understand");
  return run.step("understand", async () => {
    const out = await deps.provider.structured({
      task: "understand",
      system: systemPrompt(ctx, TASKS.understand),
      schema: understandingSchema,
      schemaName: "understanding",
      messages: [{ role: "user", content: await materialParts(deps, ctx.selectedMaterials) }],
      hints: hintsFrom(ctx),
    });
    run.addUsage(out.usage, out.model);
    return out.value;
  }, (u) => ({ themes: u.themes.length, materials: ctx.selectedMaterials.length }));
}

export interface DirectionWithIds extends Omit<Direction, "materialRefs"> {
  materialIds: string[];
}

export interface DiscoverResult {
  runId: string;
  understanding: Understanding | null;
  intro: string;
  directions: DirectionWithIds[];
}

export async function discover(deps: BrainDeps, input: { materialIds: string[]; instruction: string; conversationId?: string | null }): Promise<DiscoverResult> {
  const ctx = await assembleContext(deps.db, deps.creatorId, { intent: "discover", instruction: input.instruction, materialIds: input.materialIds, conversationId: input.conversationId });
  if (!ctx.selectedMaterials.length) {
    throw new DomainError("validation", "Bring some material first — a note, photo, voice memo or link — and I'll suggest what it could become.");
  }
  const run = await startRun(deps, "discover", { conversationId: input.conversationId, inputCategory: "materials" });
  return runGuarded(run, async () => {
    const decision = await authorizeTool(deps.db, deps.creatorId, "suggest_directions", run.id);
    if (decision.outcome === "denied") throw new DomainError("forbidden", `${decision.reason} You can change this in Creator Autonomy.`);
    const understanding = await understand(deps, ctx, run);
    progress(deps, "plan");
    const out = await run.step("plan", async () => {
      const r = await deps.provider.structured({
        task: "discover",
        system: systemPrompt(ctx, TASKS.discover),
        schema: directionsSchema,
        schemaName: "directions",
        messages: [
          {
            role: "user",
            content: `${renderMaterials(ctx.selectedMaterials)}\n\nWhat I understood: ${understanding.summary}\nThemes: ${understanding.themes.join(", ")}\n\nThe creator said: "${input.instruction}"`,
          },
        ],
        hints: hintsFrom(ctx),
      });
      run.addUsage(r.usage, r.model);
      return r.value;
    }, (d) => ({ directions: d.directions.length }));

    // Map model refs back to IDs we already hold; never trust model-invented identifiers.
    const byRef = new Map(ctx.selectedMaterials.map((m) => [m.ref, m.id]));
    const directions = out.directions
      .filter((d) => isKnownArtifactType(d.artifactType))
      .slice(0, 5)
      .map(({ materialRefs, ...d }) => ({
        ...d,
        materialIds: materialRefs.map((r) => byRef.get(r)).filter((x): x is string => !!x),
      }))
      .map((d) => ({ ...d, materialIds: d.materialIds.length ? d.materialIds : ctx.selectedMaterials.map((m) => m.id) }));
    await run.finish({ outputCategory: "directions" });
    return { runId: run.id, understanding, intro: out.intro, directions };
  });
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
export interface CreateInput {
  artifactType: string;
  instruction: string;
  materialIds: string[];
  referenceMaterialIds?: string[];
  conversationId?: string | null;
  title?: string;
  fromDirection?: string;
  sourceArtifactId?: string | null;
  /** What the run works from: confirmed by the creator, or CreatorBrain's safe defaults (recorded on the run). */
  brief?: { values: IntentBrief; source: "confirmed" | "inferred"; acknowledged?: string[] } | null;
}

export type CreateResult =
  | { kind: "artifact"; artifact: Tables<"artifacts">; runId: string; quality: QualityResult; offline: boolean }
  | { kind: "proposal"; proposal: Proposal; runId: string };

export async function create(deps: BrainDeps, input: CreateInput, opts: { approved?: boolean; retryOf?: string } = {}): Promise<CreateResult> {
  if (!isKnownArtifactType(input.artifactType)) throw new DomainError("validation", "I don't know how to make that kind of piece yet.");
  const def = artifactType(input.artifactType);
  // The chosen material leads; the confirmed brief travels with the request.
  const lead = input.brief?.values.emphasisMaterialId;
  const materialIds = lead && input.materialIds.includes(lead) ? [lead, ...input.materialIds.filter((id) => id !== lead)] : input.materialIds;
  let briefText = "";
  if (input.brief?.source === "confirmed") {
    const leadTitle = lead ? (await deps.db.from("creative_materials").select("title").eq("id", lead).maybeSingle()).data?.title : null;
    briefText = `\n\n${renderBrief(input.brief.values, leadTitle)}`;
  }
  const instruction = `${input.instruction}${briefText}`;
  const ctx = await assembleContext(deps.db, deps.creatorId, {
    intent: "create",
    instruction,
    artifactType: def.type,
    materialIds,
    referenceMaterialIds: input.referenceMaterialIds,
    conversationId: input.conversationId,
  });
  const run = await startRun(deps, "create", {
    conversationId: input.conversationId,
    inputCategory: ctx.selectedMaterials.length ? "materials" : "text",
    intentBrief: input.brief ? { ...input.brief.values, source: input.brief.source, acknowledged: input.brief.acknowledged ?? [] } : null,
    // Exactly what was asked, so a failed or cancelled run can be retried without guessing.
    request: { ...input } as Record<string, unknown>,
    retryOf: opts.retryOf ?? null,
  });
  return runGuarded(run, async () => {
    deps.onProgress?.({ step: "deciding", label: "Checking your autonomy settings" });
    const decision = await authorizeTool(deps.db, deps.creatorId, "create_artifact", run.id);
    if (decision.outcome === "denied") throw new DomainError("forbidden", `${decision.reason} You can change this in Creator Autonomy.`);
    if (decision.outcome === "needs_approval" && !opts.approved) {
      const proposal = await createProposal(deps.db, deps.creatorId, {
        tool: "create_artifact",
        understood: `You'd like a ${def.label.toLowerCase()}${ctx.selectedMaterials.length ? ` from ${ctx.selectedMaterials.length} piece${ctx.selectedMaterials.length === 1 ? "" : "s"} of material` : ""}.`,
        plan: `Draft a new ${def.label.toLowerCase()} in your voice and save it as v1.`,
        impact: "Creates a new private piece. Nothing existing changes.",
        payload: { ...input },
        runId: run.id,
        conversationId: input.conversationId,
      });
      await run.finish({ outputCategory: "proposal" });
      return { kind: "proposal" as const, proposal, runId: run.id };
    }

    const understanding = ctx.selectedMaterials.length ? await understand(deps, ctx, run) : null;
    if (!ctx.references.length) await run.skip("research", "No references attached.");
    else progress(deps, "research");

    progress(deps, "plan");
    const plan = await run.step("plan", async () => {
      const r = await deps.provider.structured({
        task: "plan",
        system: systemPrompt(ctx, `${TASKS.plan}\n${artifactBrief(def.type)}`),
        schema: planSchema,
        schemaName: "plan",
        messages: [
          {
            role: "user",
            content: `${renderMaterials(ctx.selectedMaterials)}${ctx.references.length ? `\n\nReferences:\n${renderMaterials(ctx.references)}` : ""}\n\n${understanding ? `Understanding: ${understanding.summary}\n` : ""}Request: "${input.instruction}"${input.fromDirection ? `\nChosen direction: ${input.fromDirection}` : ""}${briefText}`,
          },
        ],
        hints: hintsFrom(ctx, { title: input.title || understanding?.suggestedTitle || titleFromInstruction(input.instruction) || undefined }),
      });
      run.addUsage(r.usage, r.model);
      return r.value;
    });
    const workingTitle = input.title || (plan.title && plan.title !== "Untitled" ? plan.title : null) || understanding?.suggestedTitle || titleFromInstruction(input.instruction) || `Untitled ${def.label}`;

    progress(deps, "generate");
    const draft = await run.step("generate", async () => {
      const r = await deps.provider.generate({
        task: "generate",
        system: systemPrompt(ctx, `${TASKS.generate}\n${artifactBrief(def.type)}`),
        messages: [
          {
            role: "user",
            content: [
              ...(await materialParts(deps, ctx.selectedMaterials)),
              ...(ctx.references.length ? [{ type: "text" as const, text: `References:\n${renderMaterials(ctx.references)}` }] : []),
              { type: "text", text: `Plan:\nTitle: ${plan.title}\nApproach: ${plan.approach}\nOutline:\n${plan.outline.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\nRequest: "${input.instruction}"${briefText}` },
            ],
          },
        ],
        hints: hintsFrom(ctx, { title: workingTitle, format: def.format }),
      });
      run.addUsage(r.usage, r.model);
      return r.text.trim();
    }, (t) => ({ chars: t.length }));

    progress(deps, "validate");
    await run.step("validate", async () => {
      if (!draft) throw new DomainError("provider_failed", "The first generation came back empty. Your material is unchanged — try again.");
    });

    progress(deps, "critique");
    const quality = await qualityChecks(deps, ctx, run, def.type, draft, [...ctx.selectedMaterials, ...ctx.references].map((m) => m.id));

    progress(deps, "render");
    const home = input.conversationId ? (await deps.db.from("conversations").select("collection_id, project_id").eq("id", input.conversationId).maybeSingle()).data : null;
    const collectionId = home?.collection_id ?? null;
    const sources: LineageSource[] = [
      ...(collectionId ? [{ type: "collection" as const, id: collectionId, relationship: "references" as const }] : []),
      ...ctx.selectedMaterials.map((m) => ({ type: "material" as const, id: m.id, relationship: "created_from" as const })),
      ...ctx.references.map((m) => ({ type: "material" as const, id: m.id, relationship: "references" as const })),
      ...(input.conversationId ? [{ type: "conversation" as const, id: input.conversationId, relationship: "created_from" as const }] : []),
      ...(input.sourceArtifactId ? [{ type: "artifact" as const, id: input.sourceArtifactId, relationship: "derived_from" as const }] : []),
    ];
    const artifact = await run.step("render", () =>
      createArtifact(deps.db, deps.creatorId, {
        artifactType: def.type,
        title: workingTitle,
        description: understanding?.summary ?? null,
        content: draft,
        authorKind: "ai",
        aiRunId: run.id,
        generationMetadata: { provider: deps.provider.name, model: deps.provider.modelFor("generate"), offline: !deps.provider.live, plan: plan.outline },
        coverMaterialId: ctx.selectedMaterials.find((m) => m.imageObjectId)?.id ?? null,
        sources,
        provenance: { origin: "ai_generated", aiRunId: run.id, conversationId: input.conversationId ?? null, details: { artifactType: def.type } },
      }),
    );
    await saveQualityReport(deps, artifact.id, artifact.current_version_id!, run.id, quality);
    // Made in a project's conversation: the piece joins the project (a link; the piece stays the creator's own).
    if (home?.project_id) {
      const link = await deps.db.from("project_items").insert({ project_id: home.project_id, creator_id: deps.creatorId, kind: "artifact", artifact_id: artifact.id });
      if (link.error) log("warn", "project_link_failed", { artifactId: artifact.id, code: link.error.code });
    }
    await run.finish({ outputCategory: "artifact", artifactId: artifact.id });
    return { kind: "artifact" as const, artifact, runId: run.id, quality, offline: !deps.provider.live };
  });
}

export interface QualityResult {
  checks: QualityCheck[];
  suggestions: Array<{ title: string; detail: string }>;
}

async function qualityChecks(deps: BrainDeps, ctx: CreativeContext, run: RunTracker, type: string, content: string, sourceMaterialIds: string[]): Promise<QualityResult> {
  const heuristic = heuristicChecks(type, content, { avoid: ctx.creativeIdentity.avoid });
  const modelChecks = await run.step("critique", async () => {
    const r = await deps.provider.structured({
      task: "critique",
      system: systemPrompt(ctx, `${TASKS.critique}\n${artifactBrief(type)}`),
      schema: critiqueSchema,
      schemaName: "critique",
      messages: [{ role: "user", content: `<draft>\n${content.slice(0, 60000)}\n</draft>` }],
    });
    run.addUsage(r.usage, r.model);
    return r.value;
  }, (c) => ({ checks: c.checks.length, suggestions: c.suggestions.length }));
  // Rights & provenance come from where the material came from, never from the model or the draft.
  const rights = await provenanceCheck(deps.db, sourceMaterialIds);
  return { checks: withRightsCheck(mergeChecks(heuristic, modelChecks.checks), rights), suggestions: modelChecks.suggestions.slice(0, 3) };
}

async function saveQualityReport(deps: BrainDeps, artifactId: string, versionId: string, runId: string, r: QualityResult): Promise<string> {
  const res = await deps.db.from("quality_reports").insert({
    artifact_id: artifactId,
    version_id: versionId,
    creator_id: deps.creatorId,
    ai_run_id: runId,
    checks: r.checks as unknown as JsonValue,
    suggestions: r.suggestions as unknown as JsonValue,
  }).select("id").single();
  if (res.error) throw fromDbError(res.error);
  return res.data.id;
}

/** On-demand quality review of the current version (suggestions only, never a rewrite). */
export async function reviewQuality(deps: BrainDeps, artifactId: string) {
  const a = await getArtifact(deps.db, artifactId);
  if (a.creator_id !== deps.creatorId) throw new DomainError("forbidden", "Only the creator can run a quality review.");
  const ctx = await assembleContext(deps.db, deps.creatorId, { intent: "refine", instruction: "quality review", artifactIds: [artifactId] });
  const art = ctx.selectedArtifacts[0];
  if (!art?.versionId) throw new DomainError("validation", "There's nothing to review yet.");
  const run = await startRun(deps, "critique", { artifactId });
  return runGuarded(run, async () => {
    progress(deps, "critique");
    const result = await qualityChecks(deps, ctx, run, a.artifact_type, art.content, await artifactSourceMaterials(deps.db, a.id));
    const reportId = await saveQualityReport(deps, a.id, art.versionId!, run.id, result);
    await run.finish({ outputCategory: "quality_report" });
    return { ...result, reportId, versionId: art.versionId!, findings: findingsOf({ ...result, dismissed: [], applied: [] }) };
  });
}

// ---------------------------------------------------------------------------
// Refine (never silently overwrites: draft => proposal for review; auto => new version)
// ---------------------------------------------------------------------------
export type RefineResult =
  | { kind: "version"; artifactId: string; versionId: string; versionNumber: number; runId: string }
  | { kind: "proposal"; proposal: Proposal; runId: string; preview: string };

export async function refine(
  deps: BrainDeps,
  input: { artifactId: string; instruction: string; action?: string | null; conversationId?: string | null },
  /** previewOnly: always a proposal to review, whatever the autonomy setting (selective quality refinement). */
  opts: { previewOnly?: boolean; changeSummary?: string; quality?: { reportId: string; keys: string[]; titles: string[] } } = {},
): Promise<RefineResult> {
  const artifact = await getArtifact(deps.db, input.artifactId);
  if (artifact.creator_id !== deps.creatorId) throw new DomainError("forbidden", "You can only refine your own pieces.");
  const ctx = await assembleContext(deps.db, deps.creatorId, { intent: "refine", instruction: input.instruction, artifactIds: [artifact.id], conversationId: input.conversationId });
  const current = ctx.selectedArtifacts[0];
  if (!current?.versionId) throw new DomainError("validation", "There's no draft to refine yet.");
  const run = await startRun(deps, "refine", { artifactId: artifact.id, conversationId: input.conversationId, inputCategory: "artifact" });
  return runGuarded(run, async () => {
    progress(deps, "refine");
    const revised = await run.step("refine", async () => {
      const r = await deps.provider.generate({
        task: "refine",
        system: systemPrompt(ctx, `${TASKS.refine}\n${artifactBrief(artifact.artifact_type)}`),
        messages: [{ role: "user", content: `Request: "${input.instruction}"\n\n<current_draft>\n${current.content}\n</current_draft>` }],
        hints: { action: input.action ?? "improve", title: artifact.title, format: artifactType(artifact.artifact_type).format },
      });
      run.addUsage(r.usage, r.model);
      return r.text.trim();
    }, (t) => ({ chars: t.length }));
    progress(deps, "validate");
    if (!revised || revised === current.content.trim()) {
      throw new DomainError("provider_failed", "I couldn't find a meaningful change to make. Your current version is unchanged.");
    }
    deps.onProgress?.({ step: "deciding", label: "Checking your autonomy settings" });
    const decision = await authorizeTool(deps.db, deps.creatorId, "apply_revision", run.id);
    if (decision.outcome === "denied") throw new DomainError("forbidden", `${decision.reason} You can change this in Creator Autonomy.`);
    const summary = opts.changeSummary ?? `CreatorBrain: ${input.instruction.slice(0, 200)}`;
    if (decision.outcome === "needs_approval" || opts.previewOnly) {
      const proposal = await createProposal(deps.db, deps.creatorId, {
        tool: "apply_revision",
        understood: opts.quality ? `Apply: ${opts.quality.titles.join("; ").slice(0, 280)}` : `You asked: “${input.instruction.slice(0, 300)}”`,
        plan: `Save this revision of “${artifact.title}” as a new version.`,
        impact: `Your current v${current.versionNumber} stays in history; you can restore it anytime.`,
        payload: { artifactId: artifact.id, baseVersionId: current.versionId, content: revised, changeSummary: summary, runId: run.id, ...(opts.quality ? { quality: opts.quality } : {}) },
        runId: run.id,
        conversationId: input.conversationId,
      });
      await run.finish({ outputCategory: "proposal", artifactId: artifact.id });
      return { kind: "proposal" as const, proposal, runId: run.id, preview: revised };
    }
    progress(deps, "render");
    const v = await createVersion(deps.db, artifact.id, { content: revised, label: "Revised with CreatorBrain", authorKind: "ai", aiRunId: run.id, changeSummary: summary, generationMetadata: { provider: deps.provider.name, offline: !deps.provider.live } });
    await run.finish({ outputCategory: "version", artifactId: artifact.id });
    return { kind: "version" as const, artifactId: artifact.id, versionId: v.id, versionNumber: v.version_number, runId: run.id };
  });
}

// ---------------------------------------------------------------------------
// Transform: always a new, derived artifact (lineage preserved; never passed off as original)
// ---------------------------------------------------------------------------
export async function transform(deps: BrainDeps, input: { artifactId: string; targetType: string; instruction: string; conversationId?: string | null; versionId?: string | null }) {
  if (!isKnownArtifactType(input.targetType)) throw new DomainError("validation", "I don't know how to make that kind of piece yet.");
  const source = await getArtifact(deps.db, input.artifactId);
  // Someone else's work can only be adapted when they allowed derivatives (or their project's rights policy does).
  if (source.creator_id !== deps.creatorId) {
    const { data: permission } = await deps.db.rpc("derivative_permission", { p_artifact: source.id });
    if (permission === "project_not_allowed") throw new DomainError("forbidden", "This piece's project doesn't allow derivatives.");
    if (permission !== "allowed") throw new DomainError("forbidden", "The creator of this piece hasn't allowed derivatives.");
  }
  const def = artifactType(input.targetType);
  const ctx = await assembleContext(deps.db, deps.creatorId, { intent: "transform", instruction: input.instruction, artifactType: def.type, artifactIds: [source.id], conversationId: input.conversationId });
  const current = ctx.selectedArtifacts[0];
  if (!current) throw new DomainError("not_found", "We couldn't find that piece.");
  // Any version of the source can be adapted; the current one by default.
  let src = { content: current.content, versionId: current.versionId, versionNumber: current.versionNumber };
  if (input.versionId && input.versionId !== current.versionId) {
    const v = must(await deps.db.from("artifact_versions").select("id, version_number, content").eq("id", input.versionId).eq("artifact_id", source.id).maybeSingle(), "We couldn't find that version.");
    src = { content: v.content, versionId: v.id, versionNumber: v.version_number };
  }
  // A run is recorded against the creator's own piece; adapting someone else's is recorded without it.
  const run = await startRun(deps, "transform", { artifactId: source.creator_id === deps.creatorId ? source.id : null, conversationId: input.conversationId, inputCategory: "artifact" });
  return runGuarded(run, async () => {
    const decision = await authorizeTool(deps.db, deps.creatorId, "derive_artifact", run.id);
    if (decision.outcome === "denied") throw new DomainError("forbidden", `${decision.reason} You can change this in Creator Autonomy.`);
    progress(deps, "generate");
    const text = await run.step("generate", async () => {
      const r = await deps.provider.generate({
        task: "transform",
        system: systemPrompt(ctx, `${TASKS.transform}\n${artifactBrief(def.type)}`),
        messages: [{ role: "user", content: `Source ${artifactType(source.artifact_type).label}: “${source.title}”\n<source>\n${src.content}\n</source>\n\nRequest: "${input.instruction}"` }],
        hints: { title: `${source.title} (${def.label})`, format: def.format, keywords: extractKeywords(src.content).slice(0, 4) },
      });
      run.addUsage(r.usage, r.model);
      return r.text.trim();
    });
    if (!text) throw new DomainError("provider_failed", "The adaptation came back empty. Your original is unchanged — try again.");
    progress(deps, "critique");
    const checks = await qualityChecks(deps, ctx, run, def.type, text, await artifactSourceMaterials(deps.db, source.id));
    progress(deps, "render");
    const artifact = await createArtifact(deps.db, deps.creatorId, {
      artifactType: def.type,
      title: `${source.title} — ${def.label}`,
      description: `Adapted from “${source.title}”.`,
      content: text,
      authorKind: "ai",
      aiRunId: run.id,
      generationMetadata: { provider: deps.provider.name, offline: !deps.provider.live, sourceVersionId: src.versionId },
      coverMaterialId: source.creator_id === deps.creatorId ? source.cover_material_id : null,
      sources: [
        { type: "artifact", id: source.id, relationship: "adapted_from" },
        ...(src.versionId ? [{ type: "artifact_version" as const, id: src.versionId, relationship: "derived_from" as const }] : []),
      ],
      provenance: { origin: "derived", aiRunId: run.id, details: { sourceArtifactId: source.id, sourceVersionId: src.versionId, sourceVersionNumber: src.versionNumber } },
    });
    // Material, contributors and rights constraints follow the derivative.
    const inherited = await inheritFromSource(deps.db, deps.creatorId, artifact.id, source, src.versionId ? { id: src.versionId, number: src.versionNumber ?? 0 } : null);
    await saveQualityReport(deps, artifact.id, artifact.current_version_id!, run.id, checks);
    await run.finish({ outputCategory: "artifact", artifactId: artifact.id });
    return { artifact, runId: run.id, offline: !deps.provider.live, inherited };
  });
}

// ---------------------------------------------------------------------------
// Proposal execution (after the creator confirms)
// ---------------------------------------------------------------------------
export async function approveProposal(deps: BrainDeps, proposalId: string) {
  // Claim first (pending → approved, atomically): the stored parameters run once, never client-supplied ones.
  const p = await claimProposal(deps.db, proposalId);
  const payload = p.payload as Record<string, unknown>;
  try {
    if (p.action === "apply_revision") {
      const artifactId = String(payload.artifactId);
      const a = await getArtifact(deps.db, artifactId);
      if (a.current_version_id !== payload.baseVersionId) {
        throw new DomainError("conflict", "This piece changed since the suggestion was made. Ask CreatorBrain again for a fresh revision.");
      }
      const v = await createVersion(deps.db, artifactId, {
        content: String(payload.content),
        label: "Revised with CreatorBrain",
        authorKind: "ai",
        aiRunId: (payload.runId as string) ?? null,
        changeSummary: String(payload.changeSummary ?? "Approved revision."),
      });
      await resolveProposal(deps.db, p.id, "executed");
      const q = payload.quality as { reportId: string; keys: string[] } | undefined;
      if (q) await markApplied(deps.db, q.reportId, q.keys);
      return { kind: "version" as const, artifactId, versionId: v.id, versionNumber: v.version_number };
    }
    if (p.action === "create_artifact") {
      // The creator's confirmation is consent for this one creation; "never" still blocks it.
      const res = await create(deps, payload as unknown as CreateInput, { approved: true });
      if (res.kind !== "artifact") throw new DomainError("internal", "Approval did not produce a piece.");
      await resolveProposal(deps.db, p.id, "executed");
      return { kind: "artifact" as const, artifact: res.artifact };
    }
    throw new DomainError("validation", "This kind of proposal can't be approved here.");
  } catch (e) {
    const note = isDomainError(e) ? e.message : "Something went wrong while carrying this out.";
    await resolveProposal(deps.db, p.id, "failed", note).catch(() => undefined);
    throw e;
  }
}

export async function rejectProposal(deps: BrainDeps, proposalId: string, note?: string | null) {
  await getPendingProposal(deps.db, proposalId);
  await resolveProposal(deps.db, proposalId, "rejected", note);
}

export type { Intent };

// ---------------------------------------------------------------------------
// Selective quality refinement (P0.1-05)
// ---------------------------------------------------------------------------
/**
 * Preview a revision that applies only the findings the creator chose. Always a proposal: the creator
 * compares it with the current version and keeps or discards it; keeping it makes a new version whose
 * summary lists what was applied. Rights/provenance findings can't be "applied" by rewriting.
 */
export async function applyQualityFindings(deps: BrainDeps, artifactId: string, input: { reportId: string; keys: string[] }): Promise<RefineResult> {
  const artifact = await getArtifact(deps.db, artifactId);
  if (artifact.creator_id !== deps.creatorId) throw new DomainError("forbidden", "Only the creator can apply suggestions.");
  const report = await getReport(deps.db, artifactId, input.reportId);
  if (report.version_id !== artifact.current_version_id) throw new DomainError("conflict", "This review is for an earlier version. Review the current version first.");
  const findings = findingsOf(report);
  const chosen = findings.filter((f) => input.keys.includes(f.key));
  if (!chosen.length) throw new DomainError("validation", "Choose at least one suggestion to apply.");
  if (chosen.some((f) => f.locked)) throw new DomainError("validation", "Rights and provenance notes can't be fixed by rewriting. Check your permissions or set the piece's rights.");
  if (chosen.some((f) => f.state !== "open")) throw new DomainError("conflict", "Some of those suggestions were already applied or set aside.");
  const { instruction, summary } = selectiveInstruction(chosen);
  return refine(deps, { artifactId, instruction, action: "quality" }, { previewOnly: true, changeSummary: summary, quality: { reportId: report.id, keys: chosen.map((f) => f.key), titles: chosen.map((f) => f.title) } });
}

// ---------------------------------------------------------------------------
// Publishing copy (P0.1-10): a draft for the creator to edit; CreatorBrain never publishes by itself.
// ---------------------------------------------------------------------------
export const publicationCopySchema = z.object({
  title: z.string().trim().min(1).max(200),
  caption: z.string().trim().max(2200),
  description: z.string().trim().max(5000),
});
export type PublicationCopy = z.infer<typeof publicationCopySchema>;

export async function draftPublicationCopy(deps: BrainDeps, artifactId: string): Promise<PublicationCopy & { offline: boolean }> {
  const ctx = await assembleContext(deps.db, deps.creatorId, { intent: "question", instruction: "Draft publishing copy for this piece.", artifactIds: [artifactId] });
  const art = ctx.selectedArtifacts[0];
  if (!art || !art.content.trim()) throw new DomainError("validation", "Write something first — there's nothing to describe yet.");
  const run = await startRun(deps, "publish_copy", { artifactId, inputCategory: "artifact" });
  return runGuarded(run, async () => {
    const decision = await authorizeTool(deps.db, deps.creatorId, "draft_publication", run.id);
    if (decision.outcome === "denied") throw new DomainError("forbidden", `${decision.reason} You can change this in Creator Autonomy.`);
    const copy = await run.step("plan", async () => {
      const r = await deps.provider.structured({
        task: "publish_copy",
        system: systemPrompt(ctx, TASKS.publish_copy),
        schema: publicationCopySchema,
        schemaName: "publication_copy",
        messages: [{ role: "user", content: `${artifactType(art.type).label}: “${art.title}”\n<piece>\n${art.content.slice(0, 20000)}\n</piece>` }],
        hints: { title: art.title, keywords: extractKeywords(art.content).slice(0, 5) },
      });
      run.addUsage(r.usage, r.model);
      return r.value;
    });
    await run.finish({ outputCategory: "publication_copy", artifactId });
    return { ...copy, offline: !deps.provider.live };
  });
}

export const taskPlanSchema = z.object({
  tasks: z.array(z.object({ title: z.string().min(1).max(200), why: z.string().max(300).optional() })).max(8),
  missing: z.array(z.string().min(1).max(200)).max(3).default([]),
});
export type TaskPlan = z.infer<typeof taskPlanSchema>;

/**
 * Suggest next tasks for a project (P1-05). Suggestions only: nothing is saved, nobody is assigned and no dates are
 * set — the creator picks what to add. Governed by the Organization autonomy setting.
 */
export async function suggestProjectTasks(deps: BrainDeps, projectId: string): Promise<TaskPlan & { offline: boolean }> {
  const project = must(await deps.db.from("projects").select("id, title, status, brief, goals").eq("id", projectId).maybeSingle(), "We couldn't find that project.");
  const [tasks, milestones] = await Promise.all([
    deps.db.from("project_tasks").select("title, status").eq("project_id", projectId).limit(100),
    deps.db.from("project_milestones").select("title, due_on, done_at").eq("project_id", projectId).limit(30),
  ]);
  const ctx = await assembleContext(deps.db, deps.creatorId, { intent: "question", instruction: "Suggest next steps for this project." });
  ctx.project = { id: project.id, title: project.title, status: project.status, brief: project.brief.slice(0, 3000), goals: project.goals.slice(0, 12) };
  const run = await startRun(deps, "task_plan", { inputCategory: "text" });
  return runGuarded(run, async () => {
    const decision = await authorizeTool(deps.db, deps.creatorId, "suggest_tasks", run.id);
    if (decision.outcome === "denied") throw new DomainError("forbidden", `${decision.reason} You can change this in Creator Autonomy.`);
    const existing = (tasks.data ?? []).map((t) => `- [${t.status}] ${t.title}`).join("\n") || "(none yet)";
    const ms = (milestones.data ?? []).map((m) => `- ${m.title}${m.due_on ? ` (due ${m.due_on})` : ""}${m.done_at ? " — done" : ""}`).join("\n") || "(none yet)";
    const plan = await run.step("plan", async () => {
      const r = await deps.provider.structured({
        task: "task_plan",
        system: systemPrompt(ctx, TASKS.task_plan),
        schema: taskPlanSchema,
        schemaName: "task_plan",
        messages: [{ role: "user", content: fenceUntrusted("project tasks", `Existing tasks:\n${existing}\n\nMilestones:\n${ms}`) }],
        hints: { title: project.title },
      });
      run.addUsage(r.usage, r.model);
      return r.value;
    });
    await run.finish({ outputCategory: "task_plan" });
    const have = new Set((tasks.data ?? []).map((t) => t.title.trim().toLowerCase()));
    return { tasks: plan.tasks.filter((t) => !have.has(t.title.trim().toLowerCase())), missing: plan.missing, offline: !deps.provider.live };
  });
}

// ---------------------------------------------------------------------------
// Collaborator suggestions (P1-10): the request becomes filters; people are found and explained from facts only.
// ---------------------------------------------------------------------------
export const collaboratorQuerySchema = z.object({
  terms: z.array(z.string().trim().min(2).max(60)).max(6).default([]),
  count: z.number().int().min(1).max(10).default(5),
  networkOnly: z.boolean().default(false),
  location: z.string().trim().max(120).nullable().default(null),
  interest: z.string().trim().max(60).nullable().default(null),
});
export type CollaboratorQuery = z.infer<typeof collaboratorQuerySchema>;

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, an: 1 };
const ASK_STOPWORDS = new Set(
  "find show suggest me my our the a an some any few who whom that this these those for fit fits fitting would could might in on of to with and or people person creators creator collaborators collaborator someone somebody project network know known worked working work together near based from around please good great best".split(" "),
);

/** Offline: a plain, rule-based reading of the request (no model is involved). */
export function parseCollaboratorAsk(ask: string): CollaboratorQuery {
  const text = ask.toLowerCase();
  const n = text.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  const count = n ? Math.min(10, Math.max(1, Number(n[1]) || NUMBER_WORDS[n[1]!] || 5)) : 5;
  const networkOnly = /\b(my network|people i know|i('ve| have) worked with|worked with before|know already|already know)\b/.test(text);
  const location = text.match(/\b(?:in|near|based in|around)\s+([a-z][a-z .'-]{1,40}?)(?=[,.?!]|\s+(?:who|that|for|with)\b|$)/)?.[1]?.trim() ?? null;
  const words = text
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !ASK_STOPWORDS.has(w) && !(w in NUMBER_WORDS) && w !== location);
  return collaboratorQuerySchema.parse({ terms: [...new Set(words)].slice(0, 4), count, networkOnly, location: location && !ASK_STOPWORDS.has(location) ? location : null, interest: null });
}

/**
 * "Find three cinematographers in my network who fit this project." Suggestions only: nobody is contacted or added.
 * Governed by the Collaboration autonomy setting; every person comes with the factual reasons they were found.
 */
export async function suggestCollaborators(deps: BrainDeps, input: { ask: string; projectId?: string | null }): Promise<{ query: CollaboratorQuery; people: CollaboratorCard[]; offline: boolean }> {
  const ask = input.ask.trim().slice(0, 500);
  if (!ask) throw new DomainError("validation", "Say who you're looking for.");
  const project = input.projectId ? must(await deps.db.from("projects").select("id, title, status, brief, goals").eq("id", input.projectId).maybeSingle(), "We couldn't find that project.") : null;
  const run = await startRun(deps, "collaborator_query", { inputCategory: "text" });
  return runGuarded(run, async () => {
    const decision = await authorizeTool(deps.db, deps.creatorId, "find_collaborators", run.id);
    if (decision.outcome === "denied") throw new DomainError("forbidden", `${decision.reason} You can change this in Creator Autonomy.`);
    const query = await run.step("plan", async () => {
      if (!deps.provider.live) return parseCollaboratorAsk(ask);
      const ctx = await assembleContext(deps.db, deps.creatorId, { intent: "question", instruction: "Find collaborators." });
      if (project) ctx.project = { id: project.id, title: project.title, status: project.status, brief: project.brief.slice(0, 3000), goals: project.goals.slice(0, 12) };
      const r = await deps.provider.structured({
        task: "collaborator_query",
        system: systemPrompt(ctx, TASKS.collaborator_query),
        schema: collaboratorQuerySchema,
        schemaName: "collaborator_query",
        messages: [{ role: "user", content: fenceUntrusted("request", ask) }],
      });
      run.addUsage(r.usage, r.model);
      return r.value;
    });
    const people = await findCollaborators(deps.db, {
      terms: query.terms.map(stemTerm),
      location: query.location || null,
      interest: query.interest || null,
      networkOnly: query.networkOnly,
      projectId: project?.id ?? null,
      limit: 50,
    });
    await run.finish({ outputCategory: "collaborator_query" });
    // People already in the project's crew aren't suggested again.
    return { query, people: people.filter((p) => !p.signals.inProject).slice(0, query.count), offline: !deps.provider.live };
  });
}

// ---------------------------------------------------------------------------
// Message drafts (P1-11): CreatorBrain drafts, the creator reviews and sends. Nothing is ever sent from here.
// ---------------------------------------------------------------------------
export const messageDraftSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function draftMessage(
  deps: BrainDeps,
  input: { where: { kind: "crew"; crewId: string } | { kind: "direct"; threadId: string }; intent: string; about?: string | null },
): Promise<{ draft: string; offline: boolean }> {
  const intent = input.intent.trim().slice(0, 1000);
  if (!intent) throw new DomainError("validation", "Say what you'd like the message to say.");
  // Recent messages the creator can already read (RLS), as untrusted context.
  const recent =
    input.where.kind === "crew"
      ? await deps.db.from("crew_messages").select("body, creator_id, creators(display_name)").eq("crew_id", input.where.crewId).order("created_at", { ascending: false }).limit(12)
      : await deps.db.from("direct_messages").select("body, creator_id, creators(display_name)").eq("thread_id", input.where.threadId).order("created_at", { ascending: false }).limit(12);
  if (recent.error) throw fromDbError(recent.error);
  const history = (recent.data ?? [])
    .reverse()
    .map((m) => `${m.creator_id === deps.creatorId ? "Me" : ((m.creators as { display_name: string } | null)?.display_name ?? "Someone")}: ${m.body.slice(0, 500)}`)
    .join("\n");
  const run = await startRun(deps, "message_draft", { inputCategory: "text" });
  return runGuarded(run, async () => {
    const decision = await authorizeTool(deps.db, deps.creatorId, "draft_message", run.id);
    if (decision.outcome === "denied") throw new DomainError("forbidden", `${decision.reason} You can change this in Creator Autonomy.`);
    const ctx = await assembleContext(deps.db, deps.creatorId, { intent: "question", instruction: "Draft a message." });
    const draft = await run.step("generate", async () => {
      const r = await deps.provider.structured({
        task: "message_draft",
        system: systemPrompt(ctx, TASKS.message_draft),
        schema: messageDraftSchema,
        schemaName: "message_draft",
        messages: [
          {
            role: "user",
            content: `What I want to say: ${intent}\n${input.about ? `It's about: ${input.about.slice(0, 200)}\n` : ""}\n${fenceUntrusted("recent conversation", history || "(no messages yet)")}`,
          },
        ],
      });
      run.addUsage(r.usage, r.model);
      return r.value.body;
    });
    await run.finish({ outputCategory: "message_draft" });
    return { draft, offline: !deps.provider.live };
  });
}

// ---------------------------------------------------------------------------
// Publishing plan (P1-12): where, how and when — proposals only. The creator prepares and approves.
// ---------------------------------------------------------------------------
export const publishPlanSchema = z.object({
  destinations: z.array(z.object({ key: z.string().min(1).max(60), why: z.string().max(300) })).max(10).default([]),
  adaptations: z
    .array(z.object({ key: z.string().min(1).max(60), caption: z.string().max(2200).nullable().optional(), tags: z.array(z.string().max(40)).max(10).optional() }))
    .max(10)
    .default([]),
  schedule: z.array(z.object({ key: z.string().min(1).max(60), at: z.string().max(40).nullable(), why: z.string().max(300).optional() })).max(10).default([]),
  notes: z.array(z.string().max(300)).max(3).default([]),
});
export type PublishPlan = z.infer<typeof publishPlanSchema>;

/** The next occurrence of HH:MM in a time zone, at least `minAheadMs` from now (as an ISO string in UTC). */
export function nextLocalTime(hhmm: string, timeZone: string, now = new Date(), minAheadMs = 10 * 60_000): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const parts = (d: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map((p) => [p.type, p.value]));
  for (let day = 0; day < 3; day++) {
    const today = parts(new Date(now.getTime() + day * 86_400_000));
    const guess = Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day), h, m);
    const seen = parts(new Date(guess));
    const offset = Date.UTC(Number(seen.year), Number(seen.month) - 1, Number(seen.day), Number(seen.hour), Number(seen.minute)) - guess;
    const at = guess - offset;
    if (at >= now.getTime() + minAheadMs) return new Date(at).toISOString();
  }
  return new Date(now.getTime() + 86_400_000).toISOString();
}

export async function planPublishing(deps: BrainDeps, artifactId: string): Promise<PublishPlan & { offline: boolean }> {
  const owned = await deps.db.from("artifacts").select("creator_id").eq("id", artifactId).maybeSingle();
  if (owned.data?.creator_id !== deps.creatorId) throw new DomainError("not_found", "We couldn't find that piece.");
  const [destinations, prefs] = await Promise.all([listDestinations(deps.db), getPublishingPreferences(deps.db, deps.creatorId)]);
  const available = new Map<string, string>([["profile", "Your Wonder Creator profile"], ...destinations.filter((d) => d.status === "active").map((d) => [d.id, d.name] as [string, string])]);
  const ctx = await assembleContext(deps.db, deps.creatorId, { intent: "question", instruction: "Plan publishing for this piece.", artifactIds: [artifactId] });
  const art = ctx.selectedArtifacts[0];
  if (!art || !art.content.trim()) throw new DomainError("validation", "Write something first — there's nothing to publish yet.");
  const run = await startRun(deps, "publish_plan", { artifactId, inputCategory: "artifact" });
  return runGuarded(run, async () => {
    const decision = await authorizeTool(deps.db, deps.creatorId, "plan_publishing", run.id);
    if (decision.outcome === "denied") throw new DomainError("forbidden", `${decision.reason} You can change this in Creator Autonomy.`);
    const raw = await run.step("plan", async (): Promise<PublishPlan> => {
      if (!deps.provider.live) {
        // Offline: follow the creator's own preferences, nothing more.
        const keys = prefs.defaultDestinations.filter((k) => available.has(k));
        const chosen = keys.length ? keys : ["profile"];
        const at = prefs.preferredTime && prefs.timeZone ? nextLocalTime(prefs.preferredTime, prefs.timeZone) : null;
        return {
          destinations: chosen.map((key) => ({ key, why: keys.length ? "One of your default destinations." : "Your profile is always available." })),
          adaptations: prefs.defaultTags.length ? chosen.map((key) => ({ key, tags: prefs.defaultTags })) : [],
          schedule: chosen.map((key) => ({ key, at, why: at ? `Your preferred time (${prefs.preferredTime}, ${prefs.timeZone}).` : "Now is fine." })),
          notes: ["AI isn't connected, so this plan only uses your publishing preferences."],
        };
      }
      const list = [...available].map(([key, name]) => `- ${key}: ${name}`).join("\n");
      const pref = [
        prefs.preferredTime && prefs.timeZone ? `Preferred time: ${prefs.preferredTime} (${prefs.timeZone}).` : null,
        prefs.defaultTags.length ? `Usual tags: ${prefs.defaultTags.join(", ")}.` : null,
        prefs.captionStyle ? `Caption style: ${prefs.captionStyle}` : null,
        `Now: ${new Date().toISOString()}.`,
      ]
        .filter(Boolean)
        .join("\n");
      const r = await deps.provider.structured({
        task: "publish_plan",
        system: systemPrompt(ctx, TASKS.publish_plan),
        schema: publishPlanSchema,
        schemaName: "publish_plan",
        messages: [
          {
            role: "user",
            content: `Destinations:\n${list}\n\n${pref}\n\n${artifactType(art.type).label}: “${art.title}”\n${fenceUntrusted("piece", art.content.slice(0, 12000))}`,
          },
        ],
      });
      run.addUsage(r.usage, r.model);
      return r.value;
    });
    // Keep only what can actually be used: known destinations, future times, clean tags.
    const soon = Date.now() + 60_000;
    const plan: PublishPlan = {
      destinations: raw.destinations.filter((d) => available.has(d.key)),
      adaptations: raw.adaptations
        .filter((a) => available.has(a.key))
        .map((a) => ({ ...a, tags: a.tags ? [...new Set(a.tags.map((t) => t.replace(/^#+/, "").trim()).filter(Boolean))].slice(0, 10) : undefined })),
      schedule: raw.schedule
        .filter((s) => available.has(s.key))
        .map((s) => ({ ...s, at: s.at && !Number.isNaN(Date.parse(s.at)) && Date.parse(s.at) > soon ? new Date(Date.parse(s.at)).toISOString() : null })),
      notes: raw.notes,
    };
    await run.finish({ outputCategory: "publish_plan", artifactId });
    return { ...plan, offline: !deps.provider.live };
  });
}
