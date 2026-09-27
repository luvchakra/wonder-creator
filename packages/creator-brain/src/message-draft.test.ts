import { describe, expect, it } from "vitest";
import { TOOLS } from "./governance";
import { messageDraftSchema } from "./pipeline";
import { OfflineProvider } from "./providers/offline";

describe("message drafts", () => {
  it("are a draft-only tool under Communication autonomy (sending stays with the creator)", () => {
    expect(TOOLS.draft_message).toMatchObject({ domain: "communication", action: "draft" });
  });

  it("offline, the draft says it's only a starting point", async () => {
    const r = await new OfflineProvider().structured({ task: "message_draft", system: "", messages: [], schema: messageDraftSchema, schemaName: "message_draft" });
    expect(r.value.body).toMatch(/AI isn't connected/);
  });
});
