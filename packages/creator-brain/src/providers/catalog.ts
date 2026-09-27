/** AI providers a creator can connect their own key for (client-safe descriptions). */
export const BYOK_PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    keyLabel: "Gemini API key",
    keyHelp: "Create one in Google AI Studio.",
    dataUse:
      "With your key, CreativeMind sends the material and Creations you work on (and the context it needs) to Google under your own account and its terms. Google's handling of that data follows your agreement with Google, not Wonder Creator's.",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    keyLabel: "Anthropic API key",
    keyHelp: "Create one in the Anthropic Console.",
    dataUse:
      "With your key, CreativeMind sends the material and Creations you work on (and the context it needs) to Anthropic under your own account and its terms. Anthropic's handling of that data follows your agreement with Anthropic, not Wonder Creator's.",
  },
] as const;
export type ByokProvider = (typeof BYOK_PROVIDERS)[number]["id"];

/** What a key looks like to a person after it's saved: never more than its last four characters. */
export function keyHint(secret: string): string {
  return secret.trim().slice(-4);
}
