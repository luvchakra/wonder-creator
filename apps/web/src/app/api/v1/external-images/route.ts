import { EXTERNAL_PROVIDERS, externalConnected, searchExternalImages, type ExternalProvider } from "@wonder/creator-library";
import { z } from "zod";
import { withApi } from "@/lib/api";
import { externalKeys } from "@/lib/external-images";

/** GET /api/v1/external-images?provider&q — royalty-free pictures for the Working Table's External tab. */
export const GET = withApi(
  async ({ req }) => {
    const provider = z.enum(EXTERNAL_PROVIDERS).catch("openverse").parse(req.nextUrl.searchParams.get("provider")) as ExternalProvider;
    const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
    const keys = externalKeys();
    const r = await searchExternalImages(provider, q, keys);
    return { ...r, providers: EXTERNAL_PROVIDERS.map((p) => ({ provider: p, connected: externalConnected(p, keys) })) };
  },
  { feature: "external_image_sources_enabled", rateLimit: 60 },
);
