import { describe, expect, it } from "vitest";
import { taskPlanSchema } from "./pipeline";
import { TOOLS } from "./governance";
import { OfflineProvider } from "./providers/offline";

describe("task suggestions", () => {
  it("are a suggest-only tool under Organization autonomy", () => {
    expect(TOOLS.suggest_tasks).toMatchObject({ domain: "organization", action: "suggest" });
  });

  it("offline mode returns generic, schema-valid suggestions with no people or dates", async () => {
    const r = await new OfflineProvider().structured({ task: "task_plan", system: "", messages: [], schema: taskPlanSchema, schemaName: "task_plan" });
    expect(r.value.tasks.length).toBeGreaterThan(0);
    expect(JSON.stringify(r.value)).not.toMatch(/assignee|due|@/i);
  });

  it("rejects oversized plans", () => {
    expect(() => taskPlanSchema.parse({ tasks: Array.from({ length: 9 }, (_, i) => ({ title: `t${i}` })) })).toThrow();
  });
});
