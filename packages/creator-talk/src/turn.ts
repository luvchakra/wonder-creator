import {
  addMemory,
  applyCorrection,
  assembleContext,
  assessIntent,
  authorizeTool,
  briefSchema,
  create,
  detectIntent,
  discover,
  extractMemories,
  refine,
  resolveArtifactReference,
  systemPrompt,
  TASKS,
  transform,
  type BrainDeps,
  type Candidate,
  type CreateInput,
  type ModelMessage,
} from "@wonder/creator-brain";
import { DomainError, isDomainError, log, must } from "@wonder/core";
import { artifactType, inferAllArtifactTypes, isKnownArtifactType } from "@wonder/creator-studio";
import { z } from "zod";
import { appendMessage, startConversation, type Message } from "./conversations";

export const turnSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().trim().max(8000).default(""),
  inputMode: z.enum(["text", "voice"]).default("text"),
  materialIds: z.array(z.string().uuid()).max(12).default([]),
  artifactId: z.string().uuid().nullable().optional(),
  /** Starting a conversation from a collection: what's made there records the collection in its lineage. */
  collectionId: z.string().uuid().nullable().optional(),
  /** Starting a conversation from a project: CreatorBrain works with its brief and goals, and pieces made there join it. */
  projectId: z.string().uuid().nullable().optional(),
  /** Answer an intent-clarification question: the confirmed brief, and the consequential assumptions acknowledged. */
  clarified: z
    .object({ messageId: z.string().uuid(), brief: briefSchema, acknowledged: z.array(z.enum(["publish", "commercial", "imitation"])).max(3).default([]) })
    .optional(),
  /** Choose a direction previously offered in a "directions" message. */
  direction: z.object({ messageId: z.string().uuid(), index: z.number().int().min(0).max(9) }).optional(),
});
export type TurnInput = z.infer<typeof turnSchema>;

export interface TurnResult {
  conversationId: string;
  messages: Message[];
  runId?: string | null;
}

async function recentArtifacts(deps: BrainDeps): Promise<Candidate[]> {
  const { data } = await deps.db
    .from("artifacts")
    .select("id, title, artifact_type, updated_at")
    .eq("creator_id", deps.creatorId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(8);
  return (data ?? []).map((a) => ({ id: a.id, title: a.title, type: a.artifact_type, updatedAt: a.updated_at }));
}

/** Verify selected IDs belong to the creator (RLS-scoped read); never trust client-sent IDs blindly. */
async function ownedMaterialIds(deps: BrainDeps, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data } = await deps.db.from("creative_materials").select("id").in("id", ids).eq("creator_id", deps.creatorId);
  const ok = new Set((data ?? []).map((r) => r.id));
  return ids.filter((id) => ok.has(id));
}

async function ownedCollectionId(deps: BrainDeps, id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const { data } = await deps.db.from("material_collections").select("id").eq("id", id).eq("creator_id", deps.creatorId).maybeSingle();
  return data?.id ?? null;
}

async function ownedProjectId(deps: BrainDeps, id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const { data } = await deps.db.from("projects").select("id").eq("id", id).eq("creator_id", deps.creatorId).maybeSingle();
  return data?.id ?? null;
}

/**
 * One CreatorTalk turn. Text and voice share this engine:
 * grounding → intent → CreatorBrain → proposal / artifact / question.
 */
export async function handleTurn(outer: BrainDeps, raw: unknown): Promise<TurnResult> {
  const input = turnSchema.parse(raw);
  // Remember the run this turn started, so a failure can offer Retry and a link to its progress.
  let runId: string | null = null;
  const deps: BrainDeps = { ...outer, onRunStarted: (id, intent) => ((runId = id), outer.onRunStarted?.(id, intent)) };
  const { db, creatorId } = deps;
  const materialIds = await ownedMaterialIds(deps, input.materialIds);
  if (!input.message && !materialIds.length && !input.direction && !input.clarified) throw new DomainError("validation", "Share a thought, a file or a link to begin.");

  // Choosing a direction: parameters come from the stored message, not from the client.
  let directionChoice: { title: string; artifactType: string; description: string; materialIds: string[] } | null = null;
  if (input.direction) {
    const m = must(await db.from("conversation_messages").select("*").eq("id", input.direction.messageId).eq("kind", "directions").maybeSingle(), "Those directions are no longer available.");
    const list = (m.payload as { directions?: Array<{ title: string; artifactType: string; description: string; materialIds: string[] }> }).directions ?? [];
    directionChoice = list[input.direction.index] ?? null;
    if (!directionChoice) throw new DomainError("validation", "That direction isn't available.");
    input.conversationId = m.conversation_id;
  }

  // Answering a clarification: the request and material come from the stored question, not from the client.
  let clarification: { pendingMessage: string; materialIds: string[]; consequential: string[]; brief: z.infer<typeof briefSchema>; acknowledged: string[] } | null = null;
  if (input.clarified) {
    const q = must(await db.from("conversation_messages").select("*").eq("id", input.clarified.messageId).eq("kind", "question").maybeSingle(), "That question is no longer available.");
    const p = q.payload as { intent?: { consequentialAssumptions: Array<{ key: string }> }; pendingMessage?: string; materialIds?: string[]; answered?: boolean };
    if (!p.intent || !p.pendingMessage) throw new DomainError("validation", "That question is no longer available.");
    const answered = await db.from("conversation_messages").select("id").eq("conversation_id", q.conversation_id).eq("payload->>clarifies", q.id).limit(1);
    if (answered.data?.length) throw new DomainError("conflict", "You've already answered that — I'm working from your earlier choice.");
    const required = p.intent.consequentialAssumptions.map((c) => c.key);
    const missing = required.filter((k) => !input.clarified!.acknowledged.includes(k as "publish"));
    if (missing.length) throw new DomainError("validation", "Please confirm each point before I start.");
    if (!isKnownArtifactType(input.clarified.brief.format)) throw new DomainError("validation", "I don't know how to make that kind of piece yet.");
    const emphasis = input.clarified.brief.emphasisMaterialId;
    if (emphasis && !(p.materialIds ?? []).includes(emphasis)) throw new DomainError("validation", "Choose one of the pieces you shared.");
    clarification = { pendingMessage: p.pendingMessage, materialIds: p.materialIds ?? [], consequential: required, brief: input.clarified.brief, acknowledged: input.clarified.acknowledged };
    input.conversationId = q.conversation_id;
  }

  const conversation = input.conversationId
    ? must(await db.from("conversations").select("*").eq("id", input.conversationId).maybeSingle(), "We couldn't find that conversation.")
    : await startConversation(db, creatorId, input.message || directionChoice?.title || "New idea", await ownedCollectionId(deps, input.collectionId), await ownedProjectId(deps, input.projectId));

  const out: Message[] = [];
  const creatorText = directionChoice
    ? `Let's make: ${directionChoice.title}`
    : clarification
      ? `Let's make it: ${[artifactType(clarification.brief.format).label, clarification.brief.audience ? `for ${clarification.brief.audience}` : null, clarification.brief.length, clarification.brief.tone, clarification.brief.style === "experiment" ? "experimenting with my style" : null].filter(Boolean).join(" · ")}`
      : input.message;
  const creatorMsg = await appendMessage(db, creatorId, conversation.id, {
    role: "creator",
    content: creatorText || (materialIds.length ? `Shared ${materialIds.length} piece${materialIds.length === 1 ? "" : "s"} of material` : ""),
    inputMode: input.inputMode,
    materialIds,
    artifactIds: input.artifactId ? [input.artifactId] : [],
    // The corrected intent is part of the conversation's record (and of the run, below).
    payload: clarification ? { clarifies: input.clarified!.messageId, brief: clarification.brief, acknowledged: clarification.acknowledged } : undefined,
  });
  out.push(creatorMsg);

  const reply = (m: Parameters<typeof appendMessage>[3]) => appendMessage(db, creatorId, conversation.id, m).then((msg) => (out.push(msg), msg));

  try {
    if (directionChoice) {
      const res = await create(deps, {
        artifactType: directionChoice.artifactType,
        instruction: `${directionChoice.title}: ${directionChoice.description}`,
        materialIds: directionChoice.materialIds,
        conversationId: conversation.id,
        fromDirection: directionChoice.title,
      });
      await replyForCreate(res, reply);
      return { conversationId: conversation.id, messages: out };
    }

    if (clarification) {
      const res = await create(deps, {
        artifactType: clarification.brief.format,
        instruction: clarification.pendingMessage,
        materialIds: clarification.materialIds,
        conversationId: conversation.id,
        brief: { values: clarification.brief, source: "confirmed", acknowledged: clarification.acknowledged },
      });
      await replyForCreate(res, reply);
      return { conversationId: conversation.id, messages: out };
    }

    const intent = detectIntent(input.message, { hasSelectedArtifact: !!input.artifactId, hasMaterials: materialIds.length > 0 });

    switch (intent.intent) {
      case "correct_memory": {
        const r = await applyCorrection(db, creatorId, input.message, creatorMsg.id);
        await reply({
          role: "brain",
          content: r.removed.length
            ? `Thank you — I've let go of ${r.removed.length === 1 ? "that note" : "those notes"} about your style and kept your words instead. You can review everything in Creative Memory.`
            : "Thank you — I've noted that in your own words. You can review it in Creative Memory.",
          payload: { memory: { removed: r.removed, added: r.added?.statement ?? null } },
        });
        break;
      }
      case "remember": {
        const statement = input.message.replace(/^(please )?(remember|keep in mind|note)( that)?\s*/i, "").trim();
        const m = await addMemory(db, creatorId, { category: "creative_fact", statement: statement.charAt(0).toUpperCase() + statement.slice(1), sourceKind: "creator", sourceId: creatorMsg.id, sourceLabel: "You told CreatorBrain" });
        await reply({ role: "brain", content: m ? "I'll remember that. You can edit or remove it anytime in Creative Memory." : "I already had that noted.", payload: { memory: { added: m?.statement ?? null } } });
        break;
      }
      case "discover": {
        const all = materialIds.length ? materialIds : await lastConversationMaterials(deps, conversation.id);
        const res = await discover(deps, { materialIds: all, instruction: input.message, conversationId: conversation.id });
        if (res.understanding) {
          await reply({ role: "brain", kind: "understanding", content: res.understanding.summary, payload: { themes: res.understanding.themes, moods: res.understanding.moods }, aiRunId: res.runId });
        }
        await reply({ role: "brain", kind: "directions", content: res.intro, payload: { directions: res.directions }, aiRunId: res.runId });
        break;
      }
      case "create": {
        const all = materialIds.length ? materialIds : await lastConversationMaterials(deps, conversation.id);
        const assessment = assessIntent(input.message, { artifactType: intent.artifactType, mentionedTypes: inferAllArtifactTypes(input.message), materialCount: all.length });
        if (assessment.clarificationRequired && !input.artifactId) {
          await reply({
            role: "brain",
            kind: "question",
            content: assessment.consequentialAssumptions.length
              ? "Before I start, please confirm a couple of things so nothing important is assumed."
              : "Before I start, a quick choice or two so I don't guess wrong.",
            payload: { intent: assessment, pendingMessage: input.message, materialIds: all },
          });
          break;
        }
        const res = await create(deps, {
          artifactType: intent.artifactType!,
          instruction: input.message,
          materialIds: all,
          conversationId: conversation.id,
          sourceArtifactId: input.artifactId ?? null,
          brief: { values: assessment.defaults, source: "inferred" },
        });
        await replyForCreate(res, reply, assessment.safeAssumptions);
        break;
      }
      case "refine":
      case "transform": {
        const resolution = resolveArtifactReference(input.message, input.artifactId ?? null, await recentArtifacts(deps));
        if (resolution.kind === "ask") {
          await reply({ role: "brain", kind: "question", content: resolution.question, payload: { options: resolution.options, pendingMessage: input.message } });
          break;
        }
        if (resolution.kind === "none") {
          await reply({ role: "brain", kind: "question", content: "Which piece should I work on? Open it in the Studio or pick it here.", payload: { options: [], pendingMessage: input.message } });
          break;
        }
        if (intent.intent === "transform" && intent.artifactType) {
          const res = await transform(deps, { artifactId: resolution.artifactId, targetType: intent.artifactType, instruction: input.message, conversationId: conversation.id });
          await reply({
            role: "brain",
            kind: "artifact",
            content: `Here's a ${artifactType(intent.artifactType).label.toLowerCase()} adapted from your piece. The original is unchanged, and the new one records where it came from.`,
            payload: { artifactId: res.artifact.id, title: res.artifact.title, artifactType: res.artifact.artifact_type, offline: res.offline },
            aiRunId: res.runId,
            artifactIds: [res.artifact.id],
          });
        } else {
          const res = await refine(deps, { artifactId: resolution.artifactId, instruction: input.message, action: intent.refinementAction, conversationId: conversation.id });
          if (res.kind === "proposal") {
            await reply({
              role: "brain",
              kind: "proposal",
              content: "I've prepared a revision. Review it before it becomes the current version.",
              payload: { proposalId: res.proposal.id, understood: res.proposal.understood, plan: res.proposal.plan, impact: res.proposal.impact, preview: res.preview.slice(0, 4000), artifactId: resolution.artifactId },
              aiRunId: res.runId,
            });
          } else {
            await reply({
              role: "brain",
              kind: "artifact",
              content: `Saved as v${res.versionNumber}. Earlier versions are kept in history.`,
              payload: { artifactId: res.artifactId, versionId: res.versionId },
              aiRunId: res.runId,
              artifactIds: [res.artifactId],
            });
          }
        }
        break;
      }
      default: {
        const ctx = await assembleContext(db, creatorId, { intent: intent.intent, instruction: input.message, conversationId: conversation.id, materialIds });
        const r = await deps.provider.generate({
          task: "intent",
          system: systemPrompt(ctx, "Respond conversationally and briefly as a creative collaborator. If they seem ready to make something, offer two or three concrete possibilities. Never claim you created, saved or published anything."),
          messages: chatHistory(ctx.conversation, input.message),
          hints: { keywords: input.message.split(/\s+/).slice(0, 5) },
          maxTokens: 4000,
        });
        await reply({ role: "brain", content: r.text.trim() || "Tell me a little more about what you'd like to make." });
      }
    }
  } catch (e) {
    const message = isDomainError(e)
      ? e.message
      : "Something went wrong on my side. Nothing you shared was lost — please try again.";
    if (!isDomainError(e)) log("error", "talk.turn_failed", { error: String(e) });
    await reply({ role: "brain", kind: "error", content: message, payload: { code: isDomainError(e) ? e.code : "internal", ...(runId ? { runId } : {}) } });
  }

  // Learn only from the creator's own words, in the background of this turn.
  if (input.message && deps.provider.live) {
    try {
      // Remembering is organization work: it follows the creator's autonomy setting (memories stay drafts they can edit or remove).
      if ((await authorizeTool(db, creatorId, "save_memory", null)).outcome === "allowed") {
        const ctx = await assembleContext(db, creatorId, { intent: "remember", instruction: input.message });
        const { memories } = await extractMemories(deps.provider, systemPrompt(ctx, TASKS.memory), input.message);
        for (const m of memories) {
          await addMemory(db, creatorId, { category: m.category, statement: m.statement, sourceKind: "conversation", sourceId: conversation.id, sourceLabel: conversation.title, confidence: m.confidence });
        }
      }
    } catch (e) {
      log("warn", "talk.memory_extract_failed", { error: isDomainError(e) ? e.code : "internal" });
    }
  }
  return { conversationId: conversation.id, messages: out };
}

async function lastConversationMaterials(deps: BrainDeps, conversationId: string): Promise<string[]> {
  const { data } = await deps.db
    .from("conversation_attachments")
    .select("material_id, conversation_messages!inner(conversation_id, created_at)")
    .eq("conversation_messages.conversation_id", conversationId)
    .not("material_id", "is", null)
    .limit(12);
  return [...new Set((data ?? []).map((r) => r.material_id!).filter(Boolean))];
}

async function replyForCreate(res: Awaited<ReturnType<typeof create>>, reply: (m: Parameters<typeof appendMessage>[3]) => Promise<Message>, assumptions: string[] = []) {
  if (res.kind === "proposal") {
    await reply({
      role: "brain",
      kind: "proposal",
      content: "Before I create this, please confirm.",
      payload: { proposalId: res.proposal.id, domain: res.proposal.domain, understood: res.proposal.understood, plan: res.proposal.plan, impact: res.proposal.impact },
      aiRunId: res.runId,
    });
    return;
  }
  const attention = res.quality.checks.filter((c) => c.status === "attention");
  await reply({
    role: "brain",
    kind: "artifact",
    content: res.offline
      ? "Here's a first draft from the offline development model (a deterministic placeholder, not real AI writing). Open it in the Studio to shape it."
      : `Here's a first draft of “${res.artifact.title}”.${attention.length ? ` I noticed ${attention.length} thing${attention.length === 1 ? "" : "s"} worth a look.` : ""} Open it in the Studio to refine it.`,
    payload: {
      artifactId: res.artifact.id,
      title: res.artifact.title,
      artifactType: res.artifact.artifact_type,
      checks: res.quality.checks,
      suggestions: res.quality.suggestions,
      offline: res.offline,
      runId: res.runId,
      ...(assumptions.length ? { assumptions } : {}),
    },
    aiRunId: res.runId,
    artifactIds: [res.artifact.id],
  });
}

/** Alternate user/assistant turns ending with the creator's message (the API requires alternation). */
export function chatHistory(history: Array<{ role: "creator" | "brain"; content: string }>, message: string): ModelMessage[] {
  const msgs: ModelMessage[] = [];
  for (const m of [...history.slice(0, -1), { role: "creator" as const, content: message }]) {
    const role = m.role === "creator" ? "user" : "assistant";
    if (!msgs.length && role === "assistant") continue;
    const last = msgs.at(-1);
    if (last && last.role === role) last.content = `${last.content as string}\n\n${m.content}`;
    else msgs.push({ role, content: m.content });
  }
  return msgs;
}

/** How long a run may stay "running" without finishing before it counts as interrupted (e.g. the server stopped). */
export const RUN_STALE_MS = 10 * 60 * 1000;

/**
 * Retry a failed, cancelled or interrupted creation run with exactly what it was asked (its stored request).
 * Duplicate-safe: a run that produced a piece can't be retried, and `retry_of` is unique, so two clicks
 * start one run. The outcome is posted to the run's conversation like any other turn.
 */
export async function retryRun(outer: BrainDeps, id: string): Promise<TurnResult> {
  const { db, creatorId } = outer;
  const run = must(await db.from("ai_runs").select("*").eq("id", id).maybeSingle(), "We couldn't find that run.");
  const stale = run.status === "running" && Date.now() - new Date(run.started_at).getTime() > RUN_STALE_MS;
  if (run.artifact_id || run.status === "succeeded") throw new DomainError("conflict", "That run already finished — its piece is saved.");
  if (run.status === "running" && !stale) throw new DomainError("conflict", "That run is still going.");
  if (run.intent !== "create" || !run.request) throw new DomainError("validation", "This run can't be retried. Ask CreatorBrain again instead.");
  if (stale) await db.from("ai_runs").update({ status: "failed", failure_code: "interrupted", completed_at: new Date().toISOString() }).eq("id", run.id);
  const request = run.request as unknown as CreateInput;

  let runId: string | null = null;
  const deps: BrainDeps = { ...outer, onRunStarted: (rid, intent) => ((runId = rid), outer.onRunStarted?.(rid, intent)) };
  const out: Message[] = [];
  const conversationId = run.conversation_id;
  const reply = async (m: Parameters<typeof appendMessage>[3]) => {
    if (!conversationId) return null as unknown as Message;
    const msg = await appendMessage(db, creatorId, conversationId, m);
    out.push(msg);
    return msg;
  };
  try {
    const res = await create(deps, request, { retryOf: run.id });
    await replyForCreate(res, reply);
  } catch (e) {
    // A refused retry (already retried) is the caller's error, not a new failure to post.
    if (isDomainError(e) && e.code === "conflict" && !runId) throw e;
    const message = isDomainError(e) ? e.message : "Something went wrong on my side. Nothing you shared was lost — please try again.";
    if (!isDomainError(e)) log("error", "talk.retry_failed", { error: String(e) });
    await reply({ role: "brain", kind: "error", content: message, payload: { code: isDomainError(e) ? e.code : "internal", ...(runId ? { runId } : {}) } });
  }
  return { conversationId: conversationId ?? "", messages: out, runId };
}
