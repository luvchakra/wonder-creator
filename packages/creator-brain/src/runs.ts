import { fromDbError, publishEvent } from "@wonder/core";
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
    opts: { intent: string; provider: string; model: string; inputCategory?: string; conversationId?: string | null; artifactId?: string | null; correlationId?: string; intentBrief?: Record<string, unknown> | null },
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
      })
      .select("id")
      .single();
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

  /** Run a pipeline step and record it. `detail` must never contain private content or prompts. */
  async step<T>(name: StepName, fn: () => Promise<T>, detail: (r: T) => Record<string, unknown> = () => ({})): Promise<T> {
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
        status: "failed",
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
