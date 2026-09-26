import { DomainError } from "@wonder/core";
import { AnthropicProvider } from "./anthropic";
import { OfflineProvider } from "./offline";
import type { CreativeModelProvider, ProviderReadiness } from "./types";

export * from "./types";
export { AnthropicProvider } from "./anthropic";
export { OfflineProvider, OFFLINE_MODEL } from "./offline";

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
  // eslint-disable-next-line require-yield
  async *stream(): AsyncIterable<never> {
    this.fail();
  }
  async structured(): Promise<never> {
    this.fail();
  }
}

export interface ProviderEnv {
  ANTHROPIC_API_KEY?: string;
  WONDER_AI_PROVIDER?: string; // "anthropic" | "offline"
  WONDER_AI_MODEL?: string;
  NODE_ENV?: string;
}

/**
 * Model routing / selection. Anthropic Claude is primary. The offline provider is used only when
 * explicitly requested or outside production; production without credentials is "unavailable".
 */
export function selectProvider(env: ProviderEnv = process.env as ProviderEnv): CreativeModelProvider {
  const wanted = env.WONDER_AI_PROVIDER?.toLowerCase();
  if (wanted === "offline") return new OfflineProvider();
  if (env.ANTHROPIC_API_KEY) return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.WONDER_AI_MODEL });
  if (env.NODE_ENV !== "production") return new OfflineProvider();
  return new UnavailableProvider();
}

export function providerReadiness(env: ProviderEnv = process.env as ProviderEnv): ProviderReadiness {
  const p = selectProvider(env);
  if (p.live) return { provider: p.name, live: true, configured: true, note: `Connected (${p.modelFor("generate")}).` };
  if (p.name === "offline") {
    return { provider: "offline", live: false, configured: false, note: "Offline development model: drafts are deterministic placeholders, not real AI output." };
  }
  return { provider: "none", live: false, configured: false, note: "No AI provider is configured." };
}
