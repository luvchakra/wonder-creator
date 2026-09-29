import { DomainError, isDomainError, log } from "@wonder/core";
import { safeFetch } from "@wonder/core/server";
import {
  attributionLine,
  licenseRights,
  type RightsState,
} from "./source-rights";

/**
 * Royalty-free pictures from outside Wonder Creator (owner board "Working Table", 29 Sep 2026: "External royalty-free
 * picks — search Pixabay, Pexels and Openverse directly inside the working table").
 *
 * Provider-neutral: every provider maps to one `ExternalImage` shape carrying what the creator needs to use it
 * honestly — who made it, under which licence, and where it came from. Openverse needs no key and is filtered to
 * images licensed for commercial use and modification; Pixabay and Pexels need a server-side key and say
 * "not connected" without one (never a fake result). Every request goes through `safeFetch` (SSRF guard, size cap).
 * Search text is the creator's own; nothing private is sent.
 */

export const EXTERNAL_PROVIDERS = ["openverse", "pixabay", "pexels"] as const;
export type ExternalProvider = (typeof EXTERNAL_PROVIDERS)[number];
export const EXTERNAL_PROVIDER_LABEL: Record<ExternalProvider, string> = {
  openverse: "Openverse",
  pixabay: "Pixabay",
  pexels: "Pexels",
};

export interface ExternalImage {
  provider: ExternalProvider;
  id: string;
  title: string;
  thumbUrl: string;
  imageUrl: string;
  creator: string | null;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
  /** What the licence allows (licenseRights), and the credit to keep when one is needed. */
  rights: RightsState;
  attribution: string | null;
  /** Other copies of the same picture to try if the original host refuses us (e.g. Openverse's own proxy). */
  fallbackUrls?: string[];
}

export interface ExternalKeys {
  pixabay?: string | null;
  pexels?: string | null;
}

export const externalConnected = (p: ExternalProvider, keys: ExternalKeys) =>
  EXTERNAL_IMAGE_PROVIDERS[p].connected(keys);

async function getJson(
  url: string,
  headers?: Record<string, string>,
): Promise<unknown> {
  const res = await safeFetch(url, {
    maxBytes: 1_500_000,
    accept: "application/json",
    headers,
  });
  if (res.status === 401 || res.status === 403)
    throw new DomainError(
      "provider_unavailable",
      "That picture service isn't connected.",
    );
  if (res.status === 404)
    throw new DomainError(
      "not_found",
      "That picture isn't available any more.",
    );
  if (res.status === 429)
    throw new DomainError(
      "provider_unavailable",
      "That picture service is busy right now. Try again in a moment.",
    );
  if (res.status < 200 || res.status >= 300 || res.truncated)
    throw new DomainError(
      "provider_failed",
      "That picture service didn't answer. Try again.",
    );
  try {
    return JSON.parse(new TextDecoder().decode(res.body));
  } catch {
    throw new DomainError(
      "provider_failed",
      "That picture service didn't answer. Try again.",
    );
  }
}

type Openverse = {
  id: string;
  title?: string | null;
  url: string;
  thumbnail?: string | null;
  creator?: string | null;
  license: string;
  license_version?: string | null;
  license_url?: string | null;
  foreign_landing_url?: string | null;
};
type Pixabay = {
  id: number;
  tags?: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL?: string;
  user?: string;
  pageURL: string;
};
type Pexels = {
  id: number;
  alt?: string;
  url: string;
  photographer?: string;
  src: { medium: string; large: string; large2x?: string };
};

const withRights = (
  img: Omit<ExternalImage, "rights" | "attribution">,
): ExternalImage => ({
  ...img,
  rights: licenseRights(img.license),
  attribution: attributionLine({
    creator: img.creator,
    license: img.license,
    provider: EXTERNAL_PROVIDER_LABEL[img.provider],
  }),
});
const fromOpenverse = (r: Openverse): ExternalImage =>
  withRights({
    provider: "openverse",
    id: r.id,
    title: (r.title ?? "").trim() || "Openverse image",
    thumbUrl:
      r.thumbnail || `https://api.openverse.org/v1/images/${r.id}/thumb/`,
    imageUrl: r.url,
    creator: r.creator ?? null,
    license: `${r.license.toUpperCase() === "CC0" || r.license === "pdm" ? r.license.toUpperCase() : `CC ${r.license.toUpperCase()}`}${r.license_version ? ` ${r.license_version}` : ""}`,
    licenseUrl: r.license_url ?? null,
    sourceUrl: r.foreign_landing_url || r.url,
    // Original hosts (Flickr, museums…) sometimes refuse server requests; Openverse serves the same picture itself.
    fallbackUrls: [
      `https://api.openverse.org/v1/images/${r.id}/thumb/?full_size=true&compressed=false`,
      `https://api.openverse.org/v1/images/${r.id}/thumb/`,
    ],
  });
const fromPixabay = (r: Pixabay): ExternalImage =>
  withRights({
    provider: "pixabay",
    id: String(r.id),
    title:
      (r.tags ?? "").split(",").slice(0, 3).join(", ").trim() ||
      "Pixabay image",
    thumbUrl: r.webformatURL || r.previewURL,
    imageUrl: r.largeImageURL || r.webformatURL,
    creator: r.user ?? null,
    license: "Pixabay Content License",
    licenseUrl: "https://pixabay.com/service/license-summary/",
    sourceUrl: r.pageURL,
  });
const fromPexels = (r: Pexels): ExternalImage =>
  withRights({
    provider: "pexels",
    id: String(r.id),
    title: (r.alt ?? "").trim() || "Pexels photo",
    thumbUrl: r.src.medium,
    imageUrl: r.src.large2x || r.src.large,
    creator: r.photographer ?? null,
    license: "Pexels License",
    licenseUrl: "https://www.pexels.com/license/",
    sourceUrl: r.url,
  });

export interface ExternalSearchOptions {
  limit?: number;
}

/**
 * One royalty-free picture service (Phase 04 §9). The domain never names a provider: the Studio, the routes and the
 * Working Table speak `ExternalImage`, and adding a service means adding an adapter here.
 */
export interface ExternalImageProvider {
  id: ExternalProvider;
  label: string;
  connected(keys: ExternalKeys): boolean;
  search(
    query: string,
    keys: ExternalKeys,
    options?: ExternalSearchOptions,
  ): Promise<ExternalImage[]>;
  /** One picture by id, straight from the provider — licence and address are never taken from the browser. */
  getAsset(id: string, keys: ExternalKeys): Promise<ExternalImage>;
}

const pageSize = (o?: ExternalSearchOptions) =>
  Math.min(Math.max(o?.limit ?? 12, 1), 30);

const openverse: ExternalImageProvider = {
  id: "openverse",
  label: "Openverse",
  connected: () => true,
  async search(q, _keys, o) {
    const j = (await getJson(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${pageSize(o)}&license_type=commercial,modification&mature=false`,
    )) as { results?: Openverse[] };
    return (j.results ?? []).map(fromOpenverse);
  },
  async getAsset(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new DomainError("not_found", "That picture isn't available.");
    return fromOpenverse(
      (await getJson(
        `https://api.openverse.org/v1/images/${id}/`,
      )) as Openverse,
    );
  },
};

const pixabay: ExternalImageProvider = {
  id: "pixabay",
  label: "Pixabay",
  connected: (keys) => !!keys.pixabay,
  async search(q, keys, o) {
    const j = (await getJson(
      `https://pixabay.com/api/?key=${encodeURIComponent(keys.pixabay!)}&q=${encodeURIComponent(q)}&image_type=photo&per_page=${Math.max(pageSize(o), 3)}&safesearch=true`,
    )) as { hits?: Pixabay[] };
    return (j.hits ?? []).map(fromPixabay);
  },
  async getAsset(id, keys) {
    if (!/^\d{1,15}$/.test(id))
      throw new DomainError("not_found", "That picture isn't available.");
    const j = (await getJson(
      `https://pixabay.com/api/?key=${encodeURIComponent(keys.pixabay!)}&id=${id}`,
    )) as { hits?: Pixabay[] };
    if (!j.hits?.[0])
      throw new DomainError(
        "not_found",
        "That picture isn't available any more.",
      );
    return fromPixabay(j.hits[0]);
  },
};

const pexels: ExternalImageProvider = {
  id: "pexels",
  label: "Pexels",
  connected: (keys) => !!keys.pexels,
  async search(q, keys, o) {
    const j = (await getJson(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${pageSize(o)}`,
      { authorization: keys.pexels! },
    )) as { photos?: Pexels[] };
    return (j.photos ?? []).map(fromPexels);
  },
  async getAsset(id, keys) {
    if (!/^\d{1,15}$/.test(id))
      throw new DomainError("not_found", "That picture isn't available.");
    return fromPexels(
      (await getJson(`https://api.pexels.com/v1/photos/${id}`, {
        authorization: keys.pexels!,
      })) as Pexels,
    );
  },
};

export const EXTERNAL_IMAGE_PROVIDERS: Record<
  ExternalProvider,
  ExternalImageProvider
> = { openverse, pixabay, pexels };

/** Up to 12 pictures for a search. `connected: false` when the provider has no key here (nothing is shown). */
export async function searchExternalImages(
  provider: ExternalProvider,
  query: string,
  keys: ExternalKeys,
): Promise<{ connected: boolean; results: ExternalImage[] }> {
  const q = query.trim().slice(0, 100);
  const p = EXTERNAL_IMAGE_PROVIDERS[provider];
  if (!p.connected(keys)) return { connected: false, results: [] };
  if (!q) return { connected: true, results: [] };
  return { connected: true, results: await p.search(q, keys) };
}

/** One picture by id, straight from the provider — the licence and address are never taken from the browser. */
export async function lookupExternalImage(
  provider: ExternalProvider,
  id: string,
  keys: ExternalKeys,
): Promise<ExternalImage> {
  const p = EXTERNAL_IMAGE_PROVIDERS[provider];
  if (!p.connected(keys))
    throw new DomainError(
      "provider_unavailable",
      `${p.label} isn't connected.`,
    );
  return p.getAsset(id, keys);
}

// Image hosts (Flickr among them) refuse requests that don't look like a browser-compatible client; this still says
// who we are. Openverse's own copy only answers when any type is acceptable.
const IMAGE_UA =
  "Mozilla/5.0 (compatible; WonderCreator/1.0; royalty-free image import)";
const IMAGE_ACCEPT =
  "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5";

/**
 * The picture's bytes (up to 12 MB), fetched through the SSRF guard: the original first, then any other copy of the same
 * picture the provider serves itself. Only an image answer counts. The upload checks still run on the bytes.
 */
export async function downloadExternalImage(
  img: ExternalImage,
): Promise<Uint8Array> {
  const tried: Array<{ host: string; status: number | string }> = [];
  for (const url of [img.imageUrl, ...(img.fallbackUrls ?? [])]) {
    try {
      const res = await safeFetch(url, {
        maxBytes: 12 * 1024 * 1024,
        timeoutMs: 15_000,
        accept: IMAGE_ACCEPT,
        userAgent: IMAGE_UA,
      });
      const ok =
        res.status >= 200 &&
        res.status < 300 &&
        !res.truncated &&
        res.body.byteLength > 0 &&
        (!res.contentType || res.contentType.startsWith("image/"));
      if (ok) return res.body;
      tried.push({
        host: new URL(url).host,
        status: res.truncated ? "too_large" : res.status,
      });
    } catch (e) {
      tried.push({
        host: new URL(url).host,
        status: isDomainError(e) ? e.code : "error",
      });
    }
  }
  log("warn", "external_image.download_failed", {
    provider: img.provider,
    tried,
  });
  throw new DomainError(
    "provider_failed",
    "Couldn't bring that picture in. Try another.",
  );
}
