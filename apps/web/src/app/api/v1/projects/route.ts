import { addTemplateParts, createProject, listProjects, PROJECT_STATUSES, PART_TEMPLATE_KEYS } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";

const query = z.object({ status: z.enum([...PROJECT_STATUSES, "open", "all"]).default("open") });

export const GET = withApi(async ({ db, creatorId, req }) => ({ projects: await listProjects(db, { ...query.parse(Object.fromEntries(req.nextUrl.searchParams)), viewerId: creatorId }) }));
// A template (Song, Podcast episode, Illustrated story) lays out the Room's parts (docs/creative-room-parts.md).
const createBody = z.object({ template: z.enum(PART_TEMPLATE_KEYS as [string, ...string[]]).optional() });
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const body = await readJson(req, 20_000);
    const project = await createProject(db, creatorId, body);
    const { template } = createBody.parse(body);
    if (template) await addTemplateParts(db, creatorId, project.id, template as (typeof PART_TEMPLATE_KEYS)[number]);
    return { project };
  },
  { rateLimit: 20 },
);
