import { withApi } from "@/lib/api";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { testCareersConnection } from "@/lib/careers/wonderjobs";

/** "Test connection" (platform administrators only): Connected with the job count, Wrong key, or Unavailable. */
export const POST = withApi(
  async ({ db }) => {
    await requirePlatformAdmin(db);
    return testCareersConnection();
  },
  { rateLimit: 10 },
);
