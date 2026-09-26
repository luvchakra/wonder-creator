import { handleSchema } from "@wonder/creator-identity";
import { withApi } from "@/lib/api";

export const GET = withApi(async ({ db, creatorId, req }) => {
  const parsed = handleSchema.safeParse(req.nextUrl.searchParams.get("handle") ?? "");
  if (!parsed.success) return { available: false, reason: parsed.error.issues[0]?.message };
  const own = await db.from("creators").select("handle").eq("id", creatorId).maybeSingle();
  if (own.data?.handle === parsed.data) return { available: true };
  const { data } = await db.rpc("handle_available", { p_handle: parsed.data });
  return { available: !!data, reason: data ? undefined : "That handle is taken." };
}, { rateLimit: 60 });
