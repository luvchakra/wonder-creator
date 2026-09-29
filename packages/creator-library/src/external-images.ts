import { DomainError } from "@wonder/core";
import { safeFetch } from "@wonder/core/server";

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
export const EXTERNAL_PROVIDER_LABEL: Record<ExternalProvider, string> = { openverse: "Openverse", pixabay: "Pixabay", pexels: "Pexels" };

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
}

export interface ExternalKeys {
  pixabay?: string | null;
  pexels?: string | null;
}

export const externalConnected = (p: ExternalProvider, keys: ExternalKeys) => p === "openverse" || (p === "pixabay" ? !!keys.pixabay : !!keys.pexels);

async function getJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const res = await safeFetch(url, { maxBytes: 1_500_000, accept: "application/json", headers });
  if (res.status === 401 || res.status === 403) throw new DomainError("provider_unavailable", "That picture service isn't connected.");
  if (res.status === 404) throw new DomainError("not_found", "That picture isn't available any more.");
  if (res.status === 429) throw new DomainError("provider_unavailable", "That picture service is busy right now. Try again in a moment.");
  if (res.status < 200 || res.status >= 300 || res.truncated) throw new DomainError("provider_failed", "That picture service didn't answer. Try again.");
  try {
    return JSON.parse(new TextDecoder().decode(res.body));
  } catch {
    throw new DomainError("provider_failed", "That picture service didn't answer. Try again.");
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
type Pixabay = { id: number; tags?: string; previewURL: string; webformatURL: string; largeImageURL?: string; user?: string; pageURL: string };
type Pexels = { id: number; alt?: string; url: string; photographer?: string; src: { medium: string; large: string; large2x?: string } };

const fromOpenverse = (r: Openverse): ExternalImage => ({
  provider: "openverse",
  id: r.id,
  title: (r.title ?? "").trim() || "Openverse image",
  thumbUrl: r.thumbnail || `https://api.openverse.org/v1/images/${r.id}/thumb/`,
  imageUrl: r.url,
  creator: r.creator ?? null,
  license: `${r.license.toUpperCase() === "CC0" || r.license === "pdm" ? r.license.toUpperCase() : `CC ${r.license.toUpperCase()}`}${r.license_version ? ` ${r.license_version}` : ""}`,
  licenseUrl: r.license_url ?? null,
  sourceUrl: r.foreign_landing_url || r.url,
});
const fromPixabay = (r: Pixabay): ExternalImage => ({
  provider: "pixabay",
  id: String(r.id),
  title: (r.tags ?? "").split(",").slice(0, 3).join(", ").trim() || "Pixabay image",
  thumbUrl: r.webformatURL || r.previewURL,
  imageUrl: r.largeImageURL || r.webformatURL,
  creator: r.user ?? null,
  license: "Pixabay Content License",
  licenseUrl: "https://pixabay.com/service/license-summary/",
  sourceUrl: r.pageURL,
});
const fromPexels = (r: Pexels): ExternalImage => ({
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

/** Up to 12 pictures for a search. `connected: false` when the provider has no key here (nothing is shown). */
export async function searchExternalImages(provider: ExternalProvider, query: string, keys: ExternalKeys): Promise<{ connected: boolean; results: ExternalImage[] }> {
  const q = query.trim().slice(0, 100);
  if (!externalConnected(provider, keys)) return { connected: false, results: [] };
  if (!q) return { connected: true, results: [] };
  const e = encodeURIComponent(q);
  if (provider === "openverse") {
    const j = (await getJson(`https://api.openverse.org/v1/images/?q=${e}&page_size=12&license_type=commercial,modification&mature=false`)) as { results?: Openverse[] };
    return { connected: true, results: (j.results ?? []).map(fromOpenverse) };
  }
  if (provider === "pixabay") {
    const j = (await getJson(`https://pixabay.com/api/?key=${encodeURIComponent(keys.pixabay!)}&q=${e}&image_type=photo&per_page=12&safesearch=true`)) as { hits?: Pixabay[] };
    return { connected: true, results: (j.hits ?? []).map(fromPixabay) };
  }
  const j = (await getJson(`https://api.pexels.com/v1/search?query=${e}&per_page=12`, { authorization: keys.pexels! })) as { photos?: Pexels[] };
  return { connected: true, results: (j.photos ?? []).map(fromPexels) };
}

/** One picture by id, straight from the provider — the licence and address are never taken from the browser. */
export async function lookupExternalImage(provider: ExternalProvider, id: string, keys: ExternalKeys): Promise<ExternalImage> {
  if (!externalConnected(provider, keys)) throw new DomainError("provider_unavailable", `${EXTERNAL_PROVIDER_LABEL[provider]} isn't connected.`);
  if (provider === "openverse") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "That picture isn't available.");
    return fromOpenverse((await getJson(`https://api.openverse.org/v1/images/${id}/`)) as Openverse);
  }
  if (!/^\d{1,15}$/.test(id)) throw new DomainError("not_found", "That picture isn't available.");
  if (provider === "pixabay") {
    const j = (await getJson(`https://pixabay.com/api/?key=${encodeURIComponent(keys.pixabay!)}&id=${id}`)) as { hits?: Pixabay[] };
    if (!j.hits?.[0]) throw new DomainError("not_found", "That picture isn't available any more.");
    return fromPixabay(j.hits[0]);
  }
  return fromPexels((await getJson(`https://api.pexels.com/v1/photos/${id}`, { authorization: keys.pexels! })) as Pexels);
}

/** The picture's bytes (up to 12 MB), fetched through the SSRF guard. The upload checks still run on them. */
export async function downloadExternalImage(img: ExternalImage): Promise<Uint8Array> {
  const res = await safeFetch(img.imageUrl, { maxBytes: 12 * 1024 * 1024, accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" });
  if (res.status < 200 || res.status >= 300 || res.truncated || !res.body.byteLength) throw new DomainError("provider_failed", "Couldn't bring that picture in. Try another.");
  return res.body;
}
