/**
 * Rollout flags for the five-phase program (Phase 05 §19–20, docs/creativemind-orchestration.md). Client-safe: just
 * the names and the stage each belongs to. Resolution (from the environment) lives in `features.ts` on the server; the
 * browser receives the resolved set through `FeaturesProvider`.
 */
export const ROLLOUT_STAGES = ["A", "B", "C", "D", "E"] as const;
export type RolloutStage = (typeof ROLLOUT_STAGES)[number];

/** Each flag turns on from its stage: A internal, B small beta, C expanded beta, D AI enhancement, E general availability. */
export const FLAG_STAGE = {
  moments_enabled: "A",
  dejavu_enabled: "A",
  quick_capture_voice_enabled: "A",
  home_orchestration_enabled: "A",
  community_enabled: "B",
  open_conversations_enabled: "B",
  community_home_cards_enabled: "B",
  community_to_studio_enabled: "C",
  ask_community_enabled: "C",
  external_image_sources_enabled: "C",
  semantic_connections_enabled: "D",
  dejavu_ai_suggestions_enabled: "D",
  conversation_summaries_enabled: "D",
} as const satisfies Record<string, RolloutStage>;
export type Flag = keyof typeof FLAG_STAGE;
export const FLAGS = Object.keys(FLAG_STAGE) as Flag[];
export type Flags = Record<Flag, boolean>;

/** Which flags a stage turns on, before per-flag overrides. */
export function flagsForStage(stage: RolloutStage, overrides: Partial<Record<Flag, boolean>> = {}): Flags {
  const at = ROLLOUT_STAGES.indexOf(stage);
  return Object.fromEntries(FLAGS.map((f) => [f, overrides[f] ?? ROLLOUT_STAGES.indexOf(FLAG_STAGE[f]) <= at])) as Flags;
}
