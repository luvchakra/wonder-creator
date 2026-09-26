import {
  addMemory,
  applyCorrection,
  assembleContext,
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
  type ModelMessage,
} from "@wonder/creator-brain";
import { DomainError, isDomainError, log, must } from "@wonder/core";
import { artifactType } from "@wonder/creator-studio";
import { z } from "zod";
import { appendMessage, startConversation, type Message } from "./conversations";

export const turnSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().trim().max(8000).default(""),
  inputMode: z.enum(["text", "voice"]).default("text"),
  materialIds: z.array(z.string().uuid()).max(12).default([]),
  artifactId: z.string().uuid().nullable().optional(),
  /** Choose a direction previously offered in a "directions" message. */
  direction: z.object({ messageId: z.string().uuid(), index: z.number().int().min(0).max(9) }).optional(),
});
export type TurnInput = z.infer<typeof turnSchema>;

export interface TurnResult {
  conversationId: string;
  messages: Message[];
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

/**
 * One CreatorTalk turn. Text and voice share this engine:
 * grounding → intent → CreatorBrain → proposal / artifact / question.
 */
export async function handleTurn(deps: BrainDeps, raw: unknown): Promise<TurnResult> {
  const input = turnSchema.parse(raw);
  const { db, creatorId } = deps;
  const materialIds = await ownedMaterialIds(deps, input.materialIds);
  if (!input.message && !materialIds.length && !input.direction) throw new DomainError("validation", "Share a thought, a file or a link to begin.");

  // Choosing a direction: parameters come from the stored message, not from the client.
  let directionChoice: { title: string; artifactType: string; description: string; materialIds: string[] } | null = null;
  if (input.direction) {
    const m = must(await db.from("conversation_messages").select("*").eq("id", input.direction.messageId).eq("kind", "directions").maybeSingle(), "Those directions are no longer available.");
    const list = (m.payload as { directions?: Array<{ title: string; artifactType: string; description: string; materialIds: string[] }> }).directions ?? [];
    directionChoice = list[input.direction.index] ?? null;
    if (!directionChoice) throw new DomainError("validation", "That direction isn't available.");
    input.conversationId = m.conversation_id;
  }

  const conversation = input.conversationId
    ? must(await db.from("conversations").select("*").eq("id", input.conversationId).maybeSingle(), "We couldn't find that conversation.")
    : await startConversation(db, creatorId, input.message || directionChoice?.title || "New idea");

  const out: Message[] = [];
  const creatorText = directionChoice ? `Let's make: ${directionChoice.title}` : input.message;
  const creatorMsg = await appendMessage(db, creatorId, conversation.id, {
    role: "creator",
    content: creatorText || (materialIds.length ? `Shared ${materialIds.length} piece${materialIds.length === 1 ? "" : "s"} of material` : ""),
    inputMode: input.inputMode,
    materialIds,
    artifactIds: input.artifactId ? [input.artifactId] : [],
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
        const res = await create(deps, { artifactType: intent.artifactType!, instruction: input.message, materialIds: all, conversationId: conversation.id, sourceArtifactId: input.artifactId ?? null });
        await replyForCreate(res, reply);
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
    await reply({ role: "brain", kind: "error", content: message, payload: { code: isDomainError(e) ? e.code : "internal" } });
  }

  // Learn only from the creator's own words, in the background of this turn.
  if (input.message && deps.provider.live) {
    try {
      const ctx = await assembleContext(db, creatorId, { intent: "remember", instruction: input.message });
      const { memories } = await extractMemories(deps.provider, systemPrompt(ctx, TASKS.memory), input.message);
      for (const m of memories) {
        await addMemory(db, creatorId, { category: m.category, statement: m.statement, sourceKind: "conversation", sourceId: conversation.id, sourceLabel: conversation.title, confidence: m.confidence });
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

async function replyForCreate(res: Awaited<ReturnType<typeof create>>, reply: (m: Parameters<typeof appendMessage>[3]) => Promise<Message>) {
  if (res.kind === "proposal") {
    await reply({
      role: "brain",
      kind: "proposal",
      content: "Before I create this, please confirm.",
      payload: { proposalId: res.proposal.id, understood: res.proposal.understood, plan: res.proposal.plan, impact: res.proposal.impact },
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
