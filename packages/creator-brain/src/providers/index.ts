import { DomainError } from "@wonder/core";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OfflineProvider } from "./offline";
import type { CreativeModelProvider, ProviderReadiness } from "./types";

export * from "./types";
export { AnthropicProvider } from "./anthropic";
export { GeminiProvider } from "./gemini";
export { OfflineProvider, OFFLINE_MODEL } from "./offline";
export * from "./catalog";
export * from "./validate";

/** A provider on a creator's own key (BYOK). */
export function providerWithKey(provider: "gemini" | "anthropic", apiKey: string, model?: string | null): CreativeModelProvider {
  return provider === "gemini" ? new GeminiProvider({ apiKey, model: model ?? undefined }) : new AnthropicProvider({ apiKey, model: model ?? undefined });
}

/** A provider that is honestly unavailable: every call fails with a recoverable, creator-readable error. */
class UnavailableProvider implements CreativeModelProvider {
  readonly name = "unavailable";
  readonly live = false;
  modelFor() {
    return "none";
  }
  private fail(): never {
    throw new DomainError("provider_unavailable", "CreatorBrain isn't connected yet. Your material is saved; you can create once it's set up.");
  }
  async generate(): Promise<never> {
    this.fail();
  }
  async *stream(): AsyncIterable<never> {
    this.fail();
  }
  async structured(): Promise<never> {
    this.fail();
  }
}

export interface ProviderEnv {
  WONDERCREATOR_AI_PROVIDER?: string; // "gemini" | "anthropic" | "offline"
  WONDERCREATOR_AI_API_KEY?: string;
  WONDERCREATOR_AI_MODEL?: string; // optional model override
  NODE_ENV?: string;
}

export const AI_PROVIDERS = ["gemini", "anthropic", "offline"] as const;

/**
 * Model routing / selection from WONDERCREATOR_AI_PROVIDER + WONDERCREATOR_AI_API_KEY.
 * The offline provider is used only when explicitly requested or outside production; production
 * without a usable provider and key is "unavailable" (never a fake model).
 */
export function selectProvider(env: ProviderEnv = process.env as ProviderEnv): CreativeModelProvider {
  const wanted = env.WONDERCREATOR_AI_PROVIDER?.trim().toLowerCase();
  const apiKey = env.WONDERCREATOR_AI_API_KEY?.trim();
  const model = env.WONDERCREATOR_AI_MODEL?.trim() || undefined;
  if (wanted === "offline") return new OfflineProvider();
  if (apiKey && wanted === "gemini") return new GeminiProvider({ apiKey, model });
  if (apiKey && wanted === "anthropic") return new AnthropicProvider({ apiKey, model });
  if (env.NODE_ENV !== "production") return new OfflineProvider();
  return new UnavailableProvider();
}

export function providerReadiness(env: ProviderEnv = process.env as ProviderEnv): ProviderReadiness {
  const p = selectProvider(env);
  if (p.live) return { provider: p.name, live: true, configured: true, note: `Connected (${p.modelFor("generate")}).` };
  if (p.name === "offline") {
    return { provider: "offline", live: false, configured: false, note: "Offline development model: drafts are deterministic placeholders, not real AI output." };
  }
  return { provider: "none", live: false, configured: false, note: misconfiguration(env) };
}

/** Owner-facing reason the AI provider is not connected (names settings, never values). */
function misconfiguration(env: ProviderEnv): string {
  const wanted = env.WONDERCREATOR_AI_PROVIDER?.trim().toLowerCase();
  if (!wanted) return "No AI provider is configured.";
  if (!(AI_PROVIDERS as readonly string[]).includes(wanted)) return `Unknown AI provider "${wanted}". Use gemini or anthropic.`;
  return `AI provider "${wanted}" is selected but no API key is configured.`;
}
