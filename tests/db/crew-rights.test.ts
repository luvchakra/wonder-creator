import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertOwnership,
  createProject,
  getProjectRights,
  getRightsPolicy,
  inviteToCrew,
  linkToProject,
  listAssertions,
  projectRightsSummary,
  publicationSignoffs,
  respondToAssertion,
  respondToCrew,
  saveRightsPolicy,
  signOffPublication,
  startCrew,
} from "@wonder/creator-projects";
import {
  addCollaborator,
  approvePublication,
  cancelPublication,
  createArtifact,
  preparePublications,
  proposeChange,
  acceptProposal,
  removeCollaborator,
} from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import {
  adminClient,
  cleanupTestCreators,
  createTestCreator,
  expectDenied,
  expectOk,
  type TestCreator,
} from "./helpers";

const admin = adminClient();
let owner: TestCreator;
let ivy: TestCreator; // crew member & collaborator on the piece
let cam: TestCreator; // crew member, not on the piece
let out: TestCreator;
let projectId: string;
let piece: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const permission = async (x: TestCreator) =>
  (await x.client.rpc("derivative_permission", { p_artifact: piece })).data;

beforeAll(async () => {
  [owner, ivy, cam, out] = await Promise.all(
    ["crOwner", "crIvy", "crCam", "crOut"].map((l) => createTestCreator(l)),
  );
  projectId = (
    await createProject(db(owner), owner.creatorId, { title: "Harbour Songs" })
  ).id;
  const crewId = (await startCrew(db(owner), owner.creatorId, projectId, {}))
    .id;
  for (const m of [ivy, cam]) {
    await inviteToCrew(db(owner), crewId, { creatorId: m.creatorId });
    await respondToCrew(db(m), crewId, true);
  }
  piece = (
    await createArtifact(db(owner), owner.creatorId, {
      artifactType: "poem",
      title: "Lanterns",
      content: "First light over the harbour.",
      authorKind: "creator",
      provenance: { origin: "typed" },
    })
  ).id;
  await linkToProject(db(owner), owner.creatorId, projectId, {
    kind: "artifact",
    ids: [piece],
  });
  await addCollaborator(db(owner), owner.creatorId, piece, {
    creatorId: ivy.creatorId,
    role: "Co-writer",
    access: "propose",
  });
});
afterAll(cleanupTestCreators);

describe("project rights policy", () => {
  it("only the owner sets it; everyone in the project reads it and its history; history can't be changed", async () => {
    expect(await getRightsPolicy(db(ivy), projectId)).toMatchObject({
      derivatives: "owner_approval",
      publicationSignoff: false,
      updatedAt: null,
    });
    await expect(
      saveRightsPolicy(db(ivy), ivy.creatorId, projectId, {
        derivatives: "crew_allowed",
        publicationSignoff: false,
        attribution: "credit_all",
      }),
    ).rejects.toThrow(/Only the project's owner/);
    expectDenied(
      await ivy.client
        .from("project_rights_policies")
        .insert({ project_id: projectId, updated_by: ivy.creatorId }),
    );

    await saveRightsPolicy(db(owner), owner.creatorId, projectId, {
      derivatives: "owner_approval",
      publicationSignoff: true,
      attribution: "as_agreed",
      agreement: "Revenue split 60/40 after costs.",
    });
    expect(await getRightsPolicy(db(cam), projectId)).toMatchObject({
      publicationSignoff: true,
      attribution: "as_agreed",
      agreement: "Revenue split 60/40 after costs.",
    });
    expect(
      expectOk(
        await out.client
          .from("project_rights_policies")
          .select("project_id")
          .eq("project_id", projectId),
      ),
    ).toEqual([]);

    const { history } = await getProjectRights(
      db(cam),
      cam.creatorId,
      projectId,
    );
    expect(history[0]).toMatchObject({
      title: expect.stringContaining("sign-off required to publish"),
    });
    const ev = expectOk(
      await admin
        .from("project_rights_events")
        .select("id")
        .eq("project_id", projectId)
        .limit(1)
        .single(),
    );
    expectDenied(
      await owner.client
        .from("project_rights_events")
        .insert({ project_id: projectId, event: "fake" }),
    );
    const upd = await owner.client
      .from("project_rights_events")
      .update({ event: "x" })
      .eq("id", ev.id)
      .select("id");
    expect(upd.error ?? upd.data?.length === 0).toBeTruthy();
    expect(
      expectOk(
        await out.client
          .from("project_rights_events")
          .select("id")
          .eq("project_id", projectId),
      ),
    ).toEqual([]);
  });
});

describe("ownership assertions", () => {
  it("are statements by people involved, answered by the piece's owner; they never change the rights record", async () => {
    const id = await assertOwnership(db(ivy), projectId, {
      artifactId: piece,
      claim: "co_owner",
      sharePercent: 40,
      statement: "I wrote the second half.",
    });
    await expect(
      assertOwnership(db(ivy), projectId, {
        artifactId: piece,
        claim: "contributor_only",
        statement: "Again",
      }),
    ).rejects.toThrow(/already have an open claim/);
    await expect(
      assertOwnership(db(cam), projectId, {
        artifactId: piece,
        claim: "sole_owner",
        statement: "Mine",
      }),
    ).rejects.toThrow(/worked on a piece/);
    await expect(
      assertOwnership(db(out), projectId, {
        artifactId: piece,
        claim: "sole_owner",
        statement: "Mine",
      }),
    ).rejects.toThrow(/people in the project/);
    // The server checks the share too, not just the form.
    const bad = await ivy.client.rpc("assert_ownership", {
      p_project: projectId,
      p_artifact: piece,
      p_claim: "no_claim",
      p_statement: "x",
      p_share: 10,
    });
    expect(bad.error?.message).toMatch(/share only/);
    expectDenied(
      await ivy.client
        .from("ownership_assertions")
        .insert({
          project_id: projectId,
          artifact_id: piece,
          creator_id: ivy.creatorId,
          claim: "sole_owner",
          statement: "x",
        }),
    );

    await expect(
      respondToAssertion(db(ivy), id, { response: "acknowledge" }),
    ).rejects.toThrow(/can't do that/);
    await expect(
      respondToAssertion(db(cam), id, { response: "withdraw" }),
    ).rejects.toThrow(/can't do that/);
    await respondToAssertion(db(owner), id, {
      response: "acknowledge",
      note: "Agreed.",
    });
    const [a] = await listAssertions(db(cam), cam.creatorId, projectId);
    expect(a).toMatchObject({
      claim: "co_owner",
      sharePercent: 40,
      status: "acknowledged",
      response: { note: "Agreed." },
      mine: false,
    });
    expect(await listAssertions(db(out), out.creatorId, projectId)).toEqual([]);

    // Contribution and acknowledgement never rewrite the piece's rights record.
    const rights = expectOk(
      await admin
        .from("rights_records")
        .select("ownership_kind, rights_owners(owner_creator_id)")
        .eq("artifact_id", piece)
        .single(),
    );
    expect(rights.ownership_kind).toBe("sole");
    expect(
      (rights.rights_owners as Array<{ owner_creator_id: string | null }>).map(
        (o) => o.owner_creator_id,
      ),
    ).not.toContain(ivy.creatorId);

    await respondToAssertion(db(ivy), id, { response: "withdraw" });
    await expect(
      respondToAssertion(db(owner), id, { response: "dispute" }),
    ).rejects.toThrow(/withdrawn/);
    const events = expectOk(
      await admin
        .from("project_rights_events")
        .select("event")
        .eq("project_id", projectId),
    );
    expect(events.map((e) => e.event)).toEqual(
      expect.arrayContaining([
        "assertion_made",
        "assertion_acknowledged",
        "assertion_withdrawn",
      ]),
    );
  });
});

describe("rights summary", () => {
  it("shows every piece's record, permissions and sign-offs to people in the project only", async () => {
    const [s] = await projectRightsSummary(db(cam), projectId);
    expect(s).toMatchObject({
      artifactId: piece,
      owner: { id: owner.creatorId },
      ownershipKind: "sole",
      collaborators: [{ creatorId: ivy.creatorId, access: "propose" }],
      signoffs: [{ creatorId: ivy.creatorId, decision: null }],
    });
    expect(await projectRightsSummary(db(out), projectId)).toEqual([]);
  });
});

describe("publication sign-off", () => {
  it("blocks publishing until collaborators approve the current version; a new version needs a new sign-off", async () => {
    const [p] = await preparePublications(db(owner), owner.creatorId, piece, {
      destinations: [{ kind: "profile" }],
      title: "Lanterns",
    });
    await expect(approvePublication(db(owner), p.id)).rejects.toThrow(
      /sign off on this version/,
    );
    await expect(
      signOffPublication(db(cam), piece, { decision: "approve" }),
    ).rejects.toThrow(/isn't needed/);
    await expect(
      signOffPublication(db(owner), piece, { decision: "approve" }),
    ).rejects.toThrow(/isn't needed/);
    expectDenied(
      await ivy.client
        .from("publication_signoffs")
        .insert({
          artifact_id: piece,
          version_id: piece,
          creator_id: ivy.creatorId,
          decision: "approve",
        }),
    );

    await signOffPublication(db(ivy), piece, {
      decision: "object",
      note: "Fix the last line.",
    });
    await expect(approvePublication(db(owner), p.id)).rejects.toThrow(
      /sign off/,
    );
    await signOffPublication(db(ivy), piece, { decision: "approve" });
    expect(await publicationSignoffs(db(owner), piece)).toEqual([
      expect.objectContaining({
        creatorId: ivy.creatorId,
        decision: "approve",
      }),
    ]);
    await approvePublication(db(owner), p.id);
    await cancelPublication(db(owner), p.id).catch(() => undefined);

    // A new version (here, Ivy's accepted proposal) resets the sign-off.
    const cur = expectOk(
      await admin
        .from("artifacts")
        .select("current_version_id")
        .eq("id", piece)
        .single(),
    ).current_version_id!;
    await acceptProposal(
      db(owner),
      await proposeChange(db(ivy), ivy.creatorId, piece, {
        baseVersionId: cur,
        content: "Last light over the harbour.",
        summary: "New last line",
      }),
    );
    expect(
      (await publicationSignoffs(db(owner), piece))[0]?.decision,
    ).toBeNull();
    const [p2] = await preparePublications(db(owner), owner.creatorId, piece, {
      destinations: [{ kind: "profile" }],
      title: "Lanterns",
    });
    await expect(approvePublication(db(owner), p2.id)).rejects.toThrow(
      /sign off/,
    );
    await cancelPublication(db(owner), p2.id);

    const events = expectOk(
      await admin
        .from("project_rights_events")
        .select("event")
        .eq("project_id", projectId),
    );
    expect(events.map((e) => e.event)).toEqual(
      expect.arrayContaining([
        "publication_objected",
        "publication_signed_off",
      ]),
    );
  });
});

describe("derivative permissions", () => {
  it("apply the project policy on top of the piece's own record", async () => {
    expect(await permission(owner)).toBe("allowed");
    expect(await permission(ivy)).toBe("not_allowed"); // owner_approval + the record doesn't allow derivatives
    expect(await permission(cam)).toBe("not_found"); // can't open the piece
    await saveRightsPolicy(db(owner), owner.creatorId, projectId, {
      derivatives: "crew_allowed",
      publicationSignoff: true,
      attribution: "credit_all",
    });
    expect(await permission(ivy)).toBe("allowed");
    await saveRightsPolicy(db(owner), owner.creatorId, projectId, {
      derivatives: "not_allowed",
      publicationSignoff: true,
      attribution: "credit_all",
    });
    expect(await permission(ivy)).toBe("project_not_allowed");
    expect(await permission(owner)).toBe("allowed");
  });

  it("revoked permissions block future access and sign-off, while credit stays", async () => {
    await removeCollaborator(db(owner), piece, ivy.creatorId);
    expect(await permission(ivy)).toBe("not_found");
    expect(await publicationSignoffs(db(owner), piece)).toEqual([]);
    const versions = expectOk(
      await admin
        .from("artifact_versions")
        .select("created_by_creator_id")
        .eq("artifact_id", piece),
    );
    expect(versions.map((v) => v.created_by_creator_id)).toContain(
      ivy.creatorId,
    );
  });
});
