import { DomainError } from "@wonder/core";
import { generationView } from "@wonder/creator-brain";
import { withApi } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";

/** GET /api/v1/image-generations/:id — status and images (signed, short-lived) for the creator or the Creation's collaborators. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "That isn't available.");
  const view = await generationView(db, serviceClient(), id);
  if (!view) throw new DomainError("not_found", "That isn't available.");
  return { generation: view };
});
