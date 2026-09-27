import { withApi } from "@/lib/api";
import { providerSchema, revalidateKey } from "@/lib/byok";

/** Check the stored key with the provider again (and refresh which models it can use). */
export const POST = withApi<{ provider: string }>(async ({ creatorId }, { provider }) => revalidateKey(creatorId, providerSchema.parse(provider)), { rateLimit: 10 });
