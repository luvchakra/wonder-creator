import { describe, expect, it } from "vitest";
import { TOOLS } from "./governance";
import { collaboratorQuerySchema, parseCollaboratorAsk } from "./pipeline";
import { OfflineProvider } from "./providers/offline";

describe("collaborator suggestions", () => {
  it("are a suggest-only tool under Collaboration autonomy", () => {
    expect(TOOLS.find_collaborators).toMatchObject({ domain: "collaboration", action: "suggest" });
  });

  it("offline, a request is read by plain rules into filters", () => {
    expect(parseCollaboratorAsk("Find three cinematographers in my network who fit this project.")).toMatchObject({ terms: ["cinematographers"], count: 3, networkOnly: true });
    expect(parseCollaboratorAsk("sound designers based in Goa")).toMatchObject({ terms: ["sound", "designers"], location: "goa", networkOnly: false, count: 5 });
    expect(parseCollaboratorAsk("2 illustrators")).toMatchObject({ terms: ["illustrators"], count: 2 });
  });

  it("the offline fixture is schema-valid and never ranks people", async () => {
    const r = await new OfflineProvider().structured({ task: "collaborator_query", system: "", messages: [], schema: collaboratorQuerySchema, schemaName: "collaborator_query" });
    expect(r.value).toMatchObject({ terms: [], count: 5 });
  });
});
