import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { DomainError } from "../errors";

/**
 * SSRF protection for URL ingestion. External URLs are untrusted:
 * - http(s) only, default ports only, no embedded credentials
 * - every resolved address must be public (checked on every redirect hop)
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal", "metadata"]);

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const V4_BLOCKS: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return V4_BLOCKS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  });
}

export function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::" || v === "::1") return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(v)) return true; // hex-mapped v4: refuse
  const first = parseInt(v.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (v.startsWith("64:ff9b:") || v.startsWith("2001:db8") || v.startsWith("100::")) return true;
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip.replace(/^\[|\]$/g, ""));
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true;
}

/** Syntactic checks only (no DNS). */
export function parseExternalUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new DomainError("validation", "That doesn't look like a link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new DomainError("security_rejected", "Only web links (http or https) can be added.");
  }
  if (url.username || url.password) {
    throw new DomainError("security_rejected", "Links with embedded credentials can't be added.");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new DomainError("security_rejected", "That link points to a private network.");
  }
  if (isIP(host.replace(/^\[|\]$/g, "")) && isPrivateAddress(host)) {
    throw new DomainError("security_rejected", "That link points to a private network.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new DomainError("security_rejected", "Links to non-standard ports can't be added.");
  }
  if (raw.length > 2048) throw new DomainError("validation", "That link is too long.");
  return url;
}

export type Resolver = (host: string) => Promise<string[]>;

const defaultResolver: Resolver = async (host) => {
  const records = await lookup(host, { all: true, verbatim: true });
  return records.map((r) => r.address);
};

/** Resolve and require every address to be public (defends against DNS pointing inward). */
export async function assertPublicHost(url: URL, resolve: Resolver = defaultResolver): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : await resolve(host).catch(() => {
    throw new DomainError("validation", "We couldn't reach that link.");
  });
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new DomainError("security_rejected", "That link points to a private network.");
  }
}

export interface SafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  accept?: string;
  resolve?: Resolver;
  fetchImpl?: typeof fetch;
  /** POST a body (e.g. a signed webhook). Redirects are never followed for POSTs. */
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
  userAgent?: string;
}

export interface SafeFetchResult {
  finalUrl: string;
  status: number;
  contentType: string;
  body: Uint8Array;
  truncated: boolean;
}

/**
 * Fetch an untrusted URL: manual redirects (each hop re-validated), timeout, and a byte cap.
 * Note: there is a small TOCTOU window between DNS validation and connect; production
 * deployments should also egress through a proxy that blocks private ranges.
 */
export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const maxBytes = opts.maxBytes ?? 2_000_000;
  const post = opts.method === "POST";
  const maxRedirects = post ? 0 : (opts.maxRedirects ?? 4);
  const doFetch = opts.fetchImpl ?? fetch;
  let url = parseExternalUrl(raw);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicHost(url, opts.resolve);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
    let res: Response;
    try {
      res = await doFetch(url, {
        method: post ? "POST" : "GET",
        body: post ? opts.body : undefined,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          ...opts.headers,
          accept: opts.accept ?? "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
          "user-agent": opts.userAgent ?? "WonderCreatorBot/1.0 (+link preview)",
        },
      });
    } catch (e) {
      clearTimeout(timer);
      throw new DomainError("provider_failed", "We couldn't reach that link right now.", { cause: e });
    }
    if (res.status >= 300 && res.status < 400) {
      clearTimeout(timer);
      if (post) throw new DomainError("provider_failed", "The destination redirected instead of answering.");
      const location = res.headers.get("location");
      if (!location) throw new DomainError("provider_failed", "That link redirected somewhere we couldn't follow.");
      url = parseExternalUrl(new URL(location, url).toString());
      continue;
    }
    try {
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      let truncated = false;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) {
            chunks.push(value.subarray(0, value.byteLength - (size - maxBytes)));
            truncated = true;
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }
      const body = new Uint8Array(Math.min(size, maxBytes));
      let offset = 0;
      for (const c of chunks) {
        body.set(c, offset);
        offset += c.byteLength;
      }
      return { finalUrl: url.toString(), status: res.status, contentType: res.headers.get("content-type") ?? "", body, truncated };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new DomainError("provider_failed", "That link redirected too many times.");
}
