import type { ByokProvider } from "./catalog";

export type KeyCheck = { status: "valid"; models: string[] } | { status: "invalid"; message: string } | { status: "unreachable"; message: string };

/**
 * Check a key against the provider by listing its models (no generation, no creator content). The key is
 * sent only in a header to the provider's own API, and never included in errors or logs.
 */
export async function validateProviderKey(provider: ByokProvider, key: string, fetchImpl: typeof fetch = fetch): Promise<KeyCheck> {
  const secret = key.trim();
  if (secret.length < 10 || /\s/.test(secret)) return { status: "invalid", message: "That doesn't look like an API key." };
  let res: Response;
  try {
    res =
      provider === "gemini"
        ? await fetchImpl("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": secret }, signal: AbortSignal.timeout(8000) })
        : await fetchImpl("https://api.anthropic.com/v1/models?limit=100", { headers: { "x-api-key": secret, "anthropic-version": "2023-06-01" }, signal: AbortSignal.timeout(8000) });
  } catch {
    return { status: "unreachable", message: "We couldn't reach the provider to check the key." };
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) return { status: "invalid", message: "The provider didn't accept this key." };
  if (!res.ok) return { status: "unreachable", message: `The provider answered ${res.status}; try checking again later.` };
  const body = (await res.json().catch(() => ({}))) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>; data?: Array<{ id?: string }> };
  const models =
    provider === "gemini"
      ? (body.models ?? []).filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => (m.name ?? "").replace(/^models\//, ""))
      : (body.data ?? []).map((m) => m.id ?? "");
  return { status: "valid", models: [...new Set(models.filter((m) => /^[A-Za-z0-9._\-]{1,120}$/.test(m)))].slice(0, 200) };
}
