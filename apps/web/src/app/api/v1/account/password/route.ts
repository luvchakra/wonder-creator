import { audit, DomainError, passwordProblem } from "@wonder/core";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { describeRequest } from "@/lib/device";
import { requirePassword } from "@/lib/step-up";

/** Change password: the current one first (step-up), then the new one against the policy. Audited. */
export const POST = withApi(async ({ db, userId, creatorId, req, requestId }) => {
  const body = z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) }).parse(await readJson(req));
  await requirePassword(db, userId, body.current, "change your password");
  const { data } = await db.auth.getUser();
  const problem = passwordProblem(body.next, { email: data.user?.email });
  if (problem) throw new DomainError("validation", problem);
  if (body.next === body.current) throw new DomainError("validation", "Choose a password you haven't been using.");
  const { error } = await db.auth.updateUser({ password: body.next });
  if (error) throw new DomainError("validation", error.message);
  await audit(db, { action: "auth.password_changed", objectType: "creator", objectId: creatorId, metadata: describeRequest(req), requestId }).catch(() => undefined);
  return { ok: true };
}, { rateLimit: 5 });
