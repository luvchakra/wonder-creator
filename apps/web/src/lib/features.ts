import "server-only";
import { DomainError } from "@wonder/core";

/**
 * Feature flags for work that isn't ready for creators yet. Off unless the environment turns it on.
 * CreatorMarket (P1-18) stays off until the licensing/transaction path is production-ready (plan §39).
 */
export const features = {
  market: () => process.env.WONDERCREATOR_FEATURE_MARKET === "on",
};

/** For routes behind a flag: while it's off, the route doesn't exist. */
export function requireFeature(on: boolean) {
  if (!on) throw new DomainError("not_found", "That isn't available.");
}
