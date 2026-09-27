import { describe, expect, it } from "vitest";
import { TOOLS } from "./governance";
import { nextLocalTime, publishPlanSchema } from "./pipeline";
import { OfflineProvider } from "./providers/offline";

describe("publishing plans", () => {
  it("are a suggest-only tool under Publishing autonomy", () => {
    expect(TOOLS.plan_publishing).toMatchObject({ domain: "publishing", action: "suggest" });
    expect(TOOLS.publish).toMatchObject({ domain: "publishing", action: "execute" });
  });

  it("find the next preferred local time in the creator's time zone", () => {
    const now = new Date("2026-09-27T10:00:00Z"); // 15:30 in Kolkata
    expect(nextLocalTime("18:30", "Asia/Kolkata", now)).toBe("2026-09-27T13:00:00.000Z");
    expect(nextLocalTime("09:00", "Asia/Kolkata", now)).toBe("2026-09-28T03:30:00.000Z"); // already past today
    expect(nextLocalTime("09:00", "America/New_York", now)).toBe("2026-09-27T13:00:00.000Z"); // 06:00 there now; 09:00 EDT is still ahead
  });

  it("the offline fixture is empty and schema-valid (offline plans come from preferences)", async () => {
    const r = await new OfflineProvider().structured({ task: "publish_plan", system: "", messages: [], schema: publishPlanSchema, schemaName: "publish_plan" });
    expect(r.value).toMatchObject({ destinations: [], schedule: [] });
  });
});
