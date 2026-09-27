import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addTaskComment,
  assignTask,
  createMilestone,
  createProject,
  createTask,
  deleteTask,
  deleteTaskComment,
  inviteToCrew,
  leaveCrew,
  linkToProject,
  listTaskComments,
  listTasks,
  progressSummary,
  projectPeople,
  respondToCrew,
  setCrewRole,
  startCrew,
  unassignTask,
  updateMilestone,
  updateTask,
} from "@wonder/creator-projects";
import type { Db as AppDb } from "@wonder/db";
import { cleanupTestCreators, createMaterial, createTestCreator, expectDenied, expectOk, type TestCreator } from "./helpers";

let owner: TestCreator;
let ada: TestCreator; // admin
let bea: TestCreator; // member
let out: TestCreator; // outsider
let projectId: string;
let crewId: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [owner, ada, bea, out] = await Promise.all(["tkOwner", "tkAda", "tkBea", "tkOut"].map((l) => createTestCreator(l)));
  projectId = (await createProject(db(owner), owner.creatorId, { title: "Songs for Tomorrow" })).id;
  crewId = (await startCrew(db(owner), owner.creatorId, projectId, {})).id;
  for (const x of [ada, bea]) {
    await inviteToCrew(db(owner), crewId, { creatorId: x.creatorId });
    await respondToCrew(db(x), crewId, true);
  }
  await setCrewRole(db(owner), crewId, { creatorId: ada.creatorId, access: "admin" });
});
afterAll(cleanupTestCreators);

describe("tasks", () => {
  it("the crew adds and sees tasks; outsiders see nothing and can't add", async () => {
    const t = await createTask(db(bea), bea.creatorId, projectId, { title: "Write the chorus", dueOn: "2020-01-01" });
    const { tasks } = await listTasks(db(owner), projectId);
    expect(tasks.find((x) => x.id === t)).toMatchObject({ title: "Write the chorus", status: "todo", overdue: true, createdBy: bea.creatorId });
    expect((await listTasks(db(out), projectId)).tasks).toEqual([]);
    await expect(createTask(db(out), out.creatorId, projectId, { title: "Sneaky" })).rejects.toThrow(/owner and crew/);
    expect((await projectPeople(db(bea), projectId)).map((p) => p.id).sort()).toEqual([owner.creatorId, ada.creatorId, bea.creatorId].sort());
  });

  it("only managers assign others; everyone can take a task on; assigning outside the project is refused", async () => {
    await expect(createTask(db(bea), bea.creatorId, projectId, { title: "Mix it", assigneeIds: [ada.creatorId] })).rejects.toThrow(/Only the owner or an admin can assign/);
    // The failed attempt leaves no half-made task behind.
    expect((await listTasks(db(owner), projectId)).tasks.filter((x) => x.title === "Mix it")).toEqual([]);
    const mine = await createTask(db(bea), bea.creatorId, projectId, { title: "Record guide vocals", assigneeIds: [bea.creatorId] });
    const t = await createTask(db(ada), ada.creatorId, projectId, { title: "Book the studio", assigneeIds: [bea.creatorId, ada.creatorId] });
    await expect(assignTask(db(ada), ada.creatorId, t, out.creatorId)).rejects.toThrow();
    await assignTask(db(owner), owner.creatorId, t, owner.creatorId);
    const view = (await listTasks(db(bea), projectId)).tasks;
    expect(view.find((x) => x.id === t)!.assignees.map((a) => a.id).sort()).toEqual([owner.creatorId, ada.creatorId, bea.creatorId].sort());
    expect(view.find((x) => x.id === mine)!.assignees.map((a) => a.id)).toEqual([bea.creatorId]);
    // Bea can step off a task, but not remove someone else.
    await expect(unassignTask(db(bea), t, ada.creatorId)).rejects.toThrow();
    await unassignTask(db(bea), t, bea.creatorId);
  });

  it("people move their own and assigned tasks; managers move any; approval gates done", async () => {
    const t = await createTask(db(owner), owner.creatorId, projectId, { title: "Final master", needsApproval: true, assigneeIds: [bea.creatorId] });
    const other = await createTask(db(ada), ada.creatorId, projectId, { title: "Artwork" });
    await expect(createTask(db(bea), bea.creatorId, projectId, { title: "Self-approve", needsApproval: true })).rejects.toThrow(/decide whether a task needs approval/);
    // Bea isn't on "Artwork": nothing changes.
    await expect(updateTask(db(bea), other, { status: "in_progress" })).rejects.toThrow(/tasks you created or are assigned to/);
    await updateTask(db(bea), t, { status: "in_progress" });
    await expect(updateTask(db(bea), t, { status: "done" })).rejects.toThrow(/needs approval/);
    await expect(updateTask(db(bea), t, { needsApproval: false })).rejects.toThrow(/decide whether a task needs approval/);
    await updateTask(db(bea), t, { status: "review" });
    await updateTask(db(ada), t, { status: "done" });
    const done = (await listTasks(db(owner), projectId)).tasks.find((x) => x.id === t)!;
    expect(done).toMatchObject({ status: "done", approvedBy: ada.creatorId });
    expect(done.completedAt).toBeTruthy();
    // Reopening clears completion and approval.
    await updateTask(db(owner), t, { status: "in_progress" });
    expect((await listTasks(db(owner), projectId)).tasks.find((x) => x.id === t)).toMatchObject({ completedAt: null, approvedBy: null });
    // Direct writes can't move a task to another project.
    const elsewhere = (await createProject(db(owner), owner.creatorId, { title: "Elsewhere" })).id;
    expectDenied(await owner.client.from("project_tasks").update({ project_id: elsewhere }).eq("id", t));
  });

  it("relations stay inside the project; dependencies show as blocked work", async () => {
    const material = await createMaterial(owner, "Lyric sheet");
    await linkToProject(db(owner), owner.creatorId, projectId, { kind: "material", ids: [material] });
    const [{ id: linkId }] = expectOk(await owner.client.from("project_items").select("id").eq("project_id", projectId).eq("material_id", material));
    const m = await createMilestone(db(owner), owner.creatorId, projectId, { title: "Demo recorded", dueOn: "2030-01-01" });
    await expect(createMilestone(db(bea), bea.creatorId, projectId, { title: "Mine" })).rejects.toThrow(/owner or an admin/);
    const first = await createTask(db(owner), owner.creatorId, projectId, { title: "Finish lyrics", itemId: linkId, milestoneId: m });
    const second = await createTask(db(owner), owner.creatorId, projectId, { title: "Record demo", dependsOn: first, milestoneId: m });
    const otherProject = (await createProject(db(owner), owner.creatorId, { title: "Other" })).id;
    const foreign = await createTask(db(owner), owner.creatorId, otherProject, { title: "Unrelated" });
    await expect(updateTask(db(owner), second, { dependsOn: foreign })).rejects.toThrow(/part of this project/);
    await expect(updateTask(db(owner), second, { dependsOn: second })).rejects.toThrow();

    const { tasks, milestones } = await listTasks(db(bea), projectId);
    expect(tasks.find((x) => x.id === second)!.dependsOn).toMatchObject({ id: first, done: false });
    expect(milestones.find((x) => x.id === m)).toMatchObject({ title: "Demo recorded", tasks: 2, tasksDone: 0 });
    const s = progressSummary(tasks, milestones);
    expect(s.blocked).toBeGreaterThanOrEqual(1);
    expect(s.nextMilestone?.title).toBe("Demo recorded");
    await updateMilestone(db(ada), m, { done: true });
    expect((await listTasks(db(owner), projectId)).milestones.find((x) => x.id === m)!.doneAt).toBeTruthy();
  });

  it("comments are for the project's people; tasks are removed by their creator or managers", async () => {
    const t = await createTask(db(ada), ada.creatorId, projectId, { title: "Pick a single" });
    await addTaskComment(db(bea), bea.creatorId, t, { body: "Track 3?" });
    await expect(addTaskComment(db(out), out.creatorId, t, { body: "hi" })).rejects.toThrow(/Only people in the project/);
    const [c] = await listTaskComments(db(owner), t);
    expect(c).toMatchObject({ body: "Track 3?", author: { id: bea.creatorId } });
    await expect(deleteTaskComment(db(ada), c.id)).resolves.toBeUndefined(); // admins moderate
    await expect(deleteTask(db(bea), t)).rejects.toThrow(/tasks you created/);
    await deleteTask(db(ada), t);
  });

  it("leaving the crew keeps assignments on record but ends access", async () => {
    const t = await createTask(db(owner), owner.creatorId, projectId, { title: "Liner notes", assigneeIds: [bea.creatorId] });
    await leaveCrew(db(bea), crewId);
    expect((await listTasks(db(bea), projectId)).tasks).toEqual([]);
    await expect(updateTask(db(bea), t, { status: "done" })).rejects.toThrow();
    expect((await listTasks(db(owner), projectId)).tasks.find((x) => x.id === t)!.assignees.map((a) => a.id)).toEqual([bea.creatorId]);
  });
});
