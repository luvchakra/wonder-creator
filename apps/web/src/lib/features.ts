import "server-only";
import { DomainError } from "@wonder/core";
import { FLAGS, flagsForStage, ROLLOUT_STAGES, type Flag, type Flags, type RolloutStage } from "./flags";

/**
 * Feature flags for work that isn't ready for everyone yet. Off unless the environment turns it on.
 * CreatorMarket (P1-18) stays off until the licensing/transaction path is production-ready (plan §39).
 *
 * The five-phase program rolls out by stage (Phase 05 §20): `WONDERCREATOR_ROLLOUT_STAGE` = A | B | C | D | E (default
 * E: everything shipped is on), and any single flag can be forced with `WONDERCREATOR_FLAG_<NAME>=on|off`
 * (e.g. `WONDERCREATOR_FLAG_ASK_COMMUNITY_ENABLED=off`). Read on every request, so a change needs no rebuild.
 */
export const features = {
  market: () => process.env.WONDERCREATOR_FEATURE_MARKET === "on",
};

export function rolloutStage(): RolloutStage {
  const s = (process.env.WONDERCREATOR_ROLLOUT_STAGE ?? "E").trim().toUpperCase();
  return (ROLLOUT_STAGES as readonly string[]).includes(s) ? (s as RolloutStage) : "E";
}

export function flags(): Flags {
  const overrides: Partial<Record<Flag, boolean>> = {};
  for (const f of FLAGS) {
    const v = process.env[`WONDERCREATOR_FLAG_${f.toUpperCase()}`]?.trim().toLowerCase();
    if (v === "on" || v === "true") overrides[f] = true;
    else if (v === "off" || v === "false") overrides[f] = false;
  }
  return flagsForStage(rolloutStage(), overrides);
}

export const flagOn = (f: Flag) => flags()[f];

/** For routes behind a flag: while it's off, the route doesn't exist. */
export function requireFeature(on: boolean) {
  if (!on) throw new DomainError("not_found", "That isn't available.");
}
