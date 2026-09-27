import { findCollaborators, parseTerms } from "@wonder/creator-identity";
import { withApi } from "@/lib/api";

/**
 * Find collaborators by fit: `terms` (disciplines/skills, comma-separated), `interest`, `location`, `availability`
 * (comma-separated), `network=1`, `project`. Every result explains itself from facts; there is no score.
 */
export const GET = withApi(
  async ({ db, req }) => {
    const p = req.nextUrl.searchParams;
    const availability = (p.get("availability") ?? "open,selective").split(",").filter(Boolean);
    return {
      people: await findCollaborators(db, {
        terms: parseTerms(p.get("terms")),
        interest: p.get("interest") || null,
        location: p.get("location") || null,
        availability,
        networkOnly: p.get("network") === "1",
        projectId: p.get("project") || null,
      }),
    };
  },
  { rateLimit: 60 },
);
