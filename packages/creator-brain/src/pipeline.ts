import { DomainError, fromDbError, isDomainError, log } from "@wonder/core";
import type { Db, JsonValue, Tables } from "@wonder/db";
import { artifactType, createArtifact, createVersion, getArtifact, isKnownArtifactType, type LineageSource } from "@wonder/creator-studio";
import { renderBrief, type IntentBrief } from "./clarify";
import { assembleContext, extractKeywords, type CreativeContext, type MaterialContext } from "./context";
import { authorizeTool, createProposal, getPendingProposal, resolveProposal, type Proposal } from "./governance";
import { artifactBrief, renderMaterials, systemPrompt, TASKS } from "./prompts";
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

function startRun(deps: BrainDeps, intent: string, opts: { conversationId?: string | null; artifactId?: string | null; inputCategory?: string; intentBrief?: Record<string, unknown> | null }) {
  return RunTracker.start(deps.db, deps.creatorId, {
    intent,
    provider: deps.provider.name,
    model: deps.provider.modelFor("generate"),
    conversationId: opts.conversationId,
    artifactId: opts.artifactId,
    inputCategory: opts.inputCategory,
    correlationId: deps.correlationId,
    intentBrief: opts.intentBrief,
  });
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

export async function create(deps: BrainDeps, input: CreateInput, opts: { approved?: boolean } = {}): Promise<CreateResult> {
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
    const quality = await qualityChecks(deps, ctx, run, def.type, draft);

    progress(deps, "render");
    const collectionId = input.conversationId
      ? ((await deps.db.from("conversations").select("collection_id").eq("id", input.conversationId).maybeSingle()).data?.collection_id ?? null)
      : null;
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
    await run.finish({ outputCategory: "artifact", artifactId: artifact.id });
    return { kind: "artifact" as const, artifact, runId: run.id, quality, offline: !deps.provider.live };
  });
}

export interface QualityResult {
  checks: QualityCheck[];
  suggestions: Array<{ title: string; detail: string }>;
}

async function qualityChecks(deps: BrainDeps, ctx: CreativeContext, run: RunTracker, type: string, content: string): Promise<QualityResult> {
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
  return { checks: mergeChecks(heuristic, modelChecks.checks), suggestions: modelChecks.suggestions.slice(0, 3) };
}

async function saveQualityReport(deps: BrainDeps, artifactId: string, versionId: string, runId: string, r: QualityResult) {
  const res = await deps.db.from("quality_reports").insert({
    artifact_id: artifactId,
    version_id: versionId,
    creator_id: deps.creatorId,
    ai_run_id: runId,
    checks: r.checks as unknown as JsonValue,
    suggestions: r.suggestions as unknown as JsonValue,
  });
  if (res.error) throw fromDbError(res.error);
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
    const result = await qualityChecks(deps, ctx, run, a.artifact_type, art.content);
    await saveQualityReport(deps, a.id, art.versionId!, run.id, result);
    await run.finish({ outputCategory: "quality_report" });
    return result;
  });
}

// ---------------------------------------------------------------------------
// Refine (never silently overwrites: draft => proposal for review; auto => new version)
// ---------------------------------------------------------------------------
export type RefineResult =
  | { kind: "version"; artifactId: string; versionId: string; versionNumber: number; runId: string }
  | { kind: "proposal"; proposal: Proposal; runId: string; preview: string };

export async function refine(deps: BrainDeps, input: { artifactId: string; instruction: string; action?: string | null; conversationId?: string | null }): Promise<RefineResult> {
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
    const summary = `CreatorBrain: ${input.instruction.slice(0, 200)}`;
    if (decision.outcome === "needs_approval") {
      const proposal = await createProposal(deps.db, deps.creatorId, {
        tool: "apply_revision",
        understood: `You asked: “${input.instruction.slice(0, 300)}”`,
        plan: `Save this revision of “${artifact.title}” as a new version.`,
        impact: `Your current v${current.versionNumber} stays in history; you can restore it anytime.`,
        payload: { artifactId: artifact.id, baseVersionId: current.versionId, content: revised, changeSummary: summary, runId: run.id },
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
export async function transform(deps: BrainDeps, input: { artifactId: string; targetType: string; instruction: string; conversationId?: string | null }) {
  if (!isKnownArtifactType(input.targetType)) throw new DomainError("validation", "I don't know how to make that kind of piece yet.");
  const source = await getArtifact(deps.db, input.artifactId);
  const def = artifactType(input.targetType);
  const ctx = await assembleContext(deps.db, deps.creatorId, { intent: "transform", instruction: input.instruction, artifactType: def.type, artifactIds: [source.id], conversationId: input.conversationId });
  const src = ctx.selectedArtifacts[0];
  if (!src) throw new DomainError("not_found", "We couldn't find that piece.");
  const run = await startRun(deps, "transform", { artifactId: source.id, conversationId: input.conversationId, inputCategory: "artifact" });
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
    const checks = await qualityChecks(deps, ctx, run, def.type, text);
    progress(deps, "render");
    const artifact = await createArtifact(deps.db, deps.creatorId, {
      artifactType: def.type,
      title: `${source.title} — ${def.label}`,
      description: `Adapted from “${source.title}”.`,
      content: text,
      authorKind: "ai",
      aiRunId: run.id,
      generationMetadata: { provider: deps.provider.name, offline: !deps.provider.live, sourceVersionId: src.versionId },
      coverMaterialId: source.cover_material_id,
      sources: [
        { type: "artifact", id: source.id, relationship: "adapted_from" },
        ...(src.versionId ? [{ type: "artifact_version" as const, id: src.versionId, relationship: "derived_from" as const }] : []),
      ],
      provenance: { origin: "derived", aiRunId: run.id, details: { sourceArtifactId: source.id, sourceVersionId: src.versionId } },
    });
    await saveQualityReport(deps, artifact.id, artifact.current_version_id!, run.id, checks);
    await run.finish({ outputCategory: "artifact", artifactId: artifact.id });
    return { artifact, runId: run.id, offline: !deps.provider.live };
  });
}

// ---------------------------------------------------------------------------
// Proposal execution (after the creator confirms)
// ---------------------------------------------------------------------------
export async function approveProposal(deps: BrainDeps, proposalId: string) {
  const p = await getPendingProposal(deps.db, proposalId);
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
      return { kind: "version" as const, artifactId, versionId: v.id, versionNumber: v.version_number };
    }
    if (p.action === "create_artifact") {
      // The creator's confirmation is consent for this one creation; "never" still blocks it.
      await resolveProposal(deps.db, p.id, "executed");
      const res = await create(deps, payload as unknown as CreateInput, { approved: true });
      if (res.kind !== "artifact") throw new DomainError("internal", "Approval did not produce a piece.");
      return { kind: "artifact" as const, artifact: res.artifact };
    }
    throw new DomainError("validation", "This kind of proposal can't be approved here.");
  } catch (e) {
    if (isDomainError(e) && e.code === "conflict") await resolveProposal(deps.db, p.id, "failed").catch(() => undefined);
    throw e;
  }
}

export async function rejectProposal(deps: BrainDeps, proposalId: string) {
  await getPendingProposal(deps.db, proposalId);
  await resolveProposal(deps.db, proposalId, "rejected");
}

export type { Intent };
