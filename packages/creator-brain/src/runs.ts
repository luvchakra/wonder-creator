import { DomainError, fromDbError, publishEvent } from "@wonder/core";
import type { Db, JsonValue } from "@wonder/db";
import type { Usage } from "./providers/types";

/** USD per million tokens (input, output). Used for estimated cost only. */
const PRICING: Record<string, [number, number]> = {
  "claude-opus-5": [5, 25],
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5": [2, 10],
  "claude-haiku-4-5": [1, 5],
  "claude-fable-5-1": [10, 50],
};

export function estimateCost(model: string, usage: Usage): number {
  const p = PRICING[model];
  if (!p) return 0;
  return Math.round(((usage.inputTokens * p[0] + usage.outputTokens * p[1]) / 1_000_000) * 1e6) / 1e6;
}

export type StepName = "understand" | "research" | "plan" | "generate" | "critique" | "refine" | "validate" | "render";

export class RunTracker {
  readonly id: string;
  private started = Date.now();
  private usage: Usage = { inputTokens: 0, outputTokens: 0 };
  private model = "";

  private constructor(
    private db: Db,
    private creatorId: string,
    id: string,
  ) {
    this.id = id;
  }

  static async start(
    db: Db,
    creatorId: string,
    opts: { intent: string; provider: string; model: string; inputCategory?: string; conversationId?: string | null; artifactId?: string | null; correlationId?: string; intentBrief?: Record<string, unknown> | null; request?: Record<string, unknown> | null; retryOf?: string | null },
  ): Promise<RunTracker> {
    const { data, error } = await db
      .from("ai_runs")
      .insert({
        creator_id: creatorId,
        intent: opts.intent,
        provider: opts.provider,
        model: opts.model,
        input_category: opts.inputCategory ?? null,
        conversation_id: opts.conversationId ?? null,
        artifact_id: opts.artifactId ?? null,
        correlation_id: opts.correlationId ?? null,
        intent_brief: (opts.intentBrief ?? null) as JsonValue,
        request: (opts.request ?? null) as JsonValue,
        retry_of: opts.retryOf ?? null,
      })
      .select("id")
      .single();
    // retry_of is unique: a second retry of the same run is refused rather than duplicated.
    if (error?.code === "23505" && opts.retryOf) throw new DomainError("conflict", "That run is already being retried.");
    if (error) throw fromDbError(error);
    const t = new RunTracker(db, creatorId, data.id);
    t.model = opts.model;
    await publishEvent(db, { type: "AiRunStarted", aggregate: "ai_run", aggregateId: data.id, payload: { intent: opts.intent } });
    return t;
  }

  addUsage(u: Usage, model?: string) {
    this.usage.inputTokens += u.inputTokens;
    this.usage.outputTokens += u.outputTokens;
    if (model) this.model = model;
  }

  /** Stops before the next stage when the creator asked to cancel. Saving (render) is never interrupted once begun. */
  async checkCancelled() {
    const { data } = await this.db.from("ai_runs").select("cancel_requested_at").eq("id", this.id).maybeSingle();
    if (data?.cancel_requested_at) throw new DomainError("cancelled", "Stopped. Nothing was saved from this run.");
  }

  /** Run a pipeline step and record it. `detail` must never contain private content or prompts. */
  async step<T>(name: StepName, fn: () => Promise<T>, detail: (r: T) => Record<string, unknown> = () => ({})): Promise<T> {
    await this.checkCancelled();
    const ins = await this.db.from("ai_run_steps").insert({ run_id: this.id, creator_id: this.creatorId, step: name }).select("id").single();
    const stepId = ins.data?.id;
    try {
      const result = await fn();
      if (stepId) await this.db.from("ai_run_steps").update({ status: "succeeded", completed_at: new Date().toISOString(), detail: detail(result) as JsonValue }).eq("id", stepId);
      return result;
    } catch (e) {
      if (stepId) await this.db.from("ai_run_steps").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", stepId);
      throw e;
    }
  }

  async skip(name: StepName, reason: string) {
    await this.db.from("ai_run_steps").insert({ run_id: this.id, creator_id: this.creatorId, step: name, status: "skipped", completed_at: new Date().toISOString(), detail: { reason } });
  }

  async finish(opts: { outputCategory: string; artifactId?: string | null }) {
    await this.db
      .from("ai_runs")
      .update({
        status: "succeeded",
        output_category: opts.outputCategory,
        artifact_id: opts.artifactId ?? undefined,
        latency_ms: Date.now() - this.started,
        input_tokens: this.usage.inputTokens,
        output_tokens: this.usage.outputTokens,
        model: this.model,
        estimated_cost_usd: estimateCost(this.model, this.usage),
        completed_at: new Date().toISOString(),
      })
      .eq("id", this.id);
    await publishEvent(this.db, { type: "AiRunCompleted", aggregate: "ai_run", aggregateId: this.id, payload: { outputCategory: opts.outputCategory } });
  }

  async fail(code: string) {
    await this.db
      .from("ai_runs")
      .update({
        status: code === "cancelled" ? "cancelled" : "failed",
        failure_code: code,
        latency_ms: Date.now() - this.started,
        input_tokens: this.usage.inputTokens,
        output_tokens: this.usage.outputTokens,
        completed_at: new Date().toISOString(),
      })
      .eq("id", this.id);
    await publishEvent(this.db, { type: "AiRunFailed", aggregate: "ai_run", aggregateId: this.id, payload: { code } }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Run progress (read side) and cancellation
// ---------------------------------------------------------------------------

/** The stages a creation run moves through, in order, with creator-facing labels. */
export const RUN_STAGES: Array<{ step: StepName; label: string }> = [
  { step: "understand", label: "Understanding your material" },
  { step: "research", label: "Gathering references" },
  { step: "plan", label: "Planning the Creation" },
  { step: "generate", label: "Creating" },
  { step: "critique", label: "Checking quality" },
  { step: "refine", label: "Refining" },
  { step: "validate", label: "Validating" },
  { step: "render", label: "Saving your draft" },
];

/** A run still "running" after this long without finishing is treated as interrupted. */
export const RUN_STALE_AFTER_MS = 10 * 60 * 1000;

export type StageState = "done" | "current" | "skipped" | "failed" | "pending";

export interface RunProgress {
  run: {
    id: string;
    intent: string;
    status: "running" | "succeeded" | "failed" | "cancelled" | "interrupted";
    failureCode: string | null;
    startedAt: string;
    completedAt: string | null;
    cancelRequested: boolean;
    conversationId: string | null;
    retryOf: string | null;
    retriedBy: string | null;
    /** Retry is offered only when it can't duplicate a piece. */
    canRetry: boolean;
    /** Cancel is offered until saving begins. */
    canCancel: boolean;
  };
  stages: Array<{ step: StepName; label: string; state: StageState; note: string | null }>;
  artifact: { id: string; title: string } | null;
}

export async function getRunProgress(db: Db, id: string): Promise<RunProgress> {
  const { data: run, error } = await db
    .from("ai_runs")
    .select("id, intent, status, failure_code, started_at, completed_at, cancel_requested_at, conversation_id, artifact_id, retry_of, request")
    .eq("id", id)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!run) throw new DomainError("not_found", "We couldn't find that run.");
  const [steps, retried, artifact] = await Promise.all([
    db.from("ai_run_steps").select("step, status, detail, started_at").eq("run_id", id).order("started_at"),
    db.from("ai_runs").select("id").eq("retry_of", id).maybeSingle(),
    run.artifact_id ? db.from("artifacts").select("id, title").eq("id", run.artifact_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const stale = run.status === "running" && Date.now() - new Date(run.started_at).getTime() > RUN_STALE_AFTER_MS;
  const status: RunProgress["run"]["status"] = stale ? "interrupted" : (run.status as RunProgress["run"]["status"]);
  const byStep = new Map<string, { status: string; detail: unknown }>();
  for (const s of steps.data ?? []) byStep.set(s.step, { status: s.status, detail: s.detail });
  const stages = RUN_STAGES.map(({ step, label }) => {
    const s = byStep.get(step);
    let state: StageState = "pending";
    if (s?.status === "succeeded") state = "done";
    else if (s?.status === "skipped") state = "skipped";
    else if (s?.status === "failed") state = "failed";
    else if (s?.status === "running") state = status === "running" ? "current" : "failed";
    const reason = s?.status === "skipped" ? ((s.detail as { reason?: string } | null)?.reason ?? null) : null;
    return { step, label, state, note: reason };
  });
  // Stages the run never reaches (e.g. refine when nothing needed refining) stay "pending" until it ends;
  // once it has succeeded they read as skipped.
  if (status === "succeeded") for (const s of stages) if (s.state === "pending") s.state = "skipped";
  const renderBegan = byStep.has("render");
  return {
    run: {
      id: run.id,
      intent: run.intent,
      status,
      failureCode: stale ? "interrupted" : run.failure_code,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      cancelRequested: !!run.cancel_requested_at,
      conversationId: run.conversation_id,
      retryOf: run.retry_of,
      retriedBy: retried.data?.id ?? null,
      canRetry: (status === "failed" || status === "cancelled" || status === "interrupted") && run.intent === "create" && !!run.request && !run.artifact_id && !retried.data,
      canCancel: status === "running" && !run.cancel_requested_at && !renderBegan,
    },
    stages,
    artifact: artifact.data ? { id: artifact.data.id, title: artifact.data.title } : null,
  };
}

/** Ask a running run to stop before its next stage (owner only, via RLS). */
export async function requestCancel(db: Db, id: string): Promise<{ ok: true; alreadyFinished?: boolean }> {
  const { data, error } = await db.from("ai_runs").update({ cancel_requested_at: new Date().toISOString() }).eq("id", id).eq("status", "running").is("cancel_requested_at", null).select("id");
  if (error) throw fromDbError(error);
  if (!data?.length) {
    const exists = await db.from("ai_runs").select("id").eq("id", id).maybeSingle();
    if (!exists.data) throw new DomainError("not_found", "We couldn't find that run.");
    return { ok: true, alreadyFinished: true };
  }
  return { ok: true };
}
