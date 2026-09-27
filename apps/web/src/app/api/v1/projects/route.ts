import { createProject, listProjects, PROJECT_STATUSES } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";

const query = z.object({ status: z.enum([...PROJECT_STATUSES, "open", "all"]).default("open") });

export const GET = withApi(async ({ db, req }) => ({ projects: await listProjects(db, query.parse(Object.fromEntries(req.nextUrl.searchParams))) }));
export const POST = withApi(async ({ db, creatorId, req }) => ({ project: await createProject(db, creatorId, await readJson(req, 20_000)) }), { rateLimit: 20 });
