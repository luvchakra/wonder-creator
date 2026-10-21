import "server-only";
import { platformAdminEmail } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

/** Whether the person looking is a platform administrator (they get the reason; visitors get a calm notice). */
export async function viewerIsPlatformAdmin(): Promise<boolean> {
  try {
    return !!(await platformAdminEmail(await createClient()));
  } catch {
    return false;
  }
}
