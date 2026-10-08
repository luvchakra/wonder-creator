import { DomainError } from "@wonder/core";
import { nextOnboardingStep, saveAbout, setOnboardingStep } from "@wonder/creator-identity";
import { ensureDefaultShelves } from "@wonder/creator-library";
import { readJson, withApi } from "@/lib/api";
import { seedProfileMemories } from "@/lib/profile-memories";

/**
 * POST /api/v1/creators/onboarding/about — the one onboarding step (owner, 8 Oct 2026: "shorten the onboarding"): a name
 * and a handle, and the creator is in. Everything else about them is asked where it matters, in Settings, when they get
 * to it. What they've already said there (a creator finishing a wizard they left midway) seeds Creative Memory now.
 */
export const POST = withApi<{ step: string }>(async ({ db, creatorId, req }, { step }) => {
  if (step !== "about") throw new DomainError("not_found", "Unknown step.");
  await saveAbout(db, creatorId, await readJson(req));
  const next = nextOnboardingStep("about");
  await setOnboardingStep(db, creatorId, next);
  await Promise.all([seedProfileMemories(db, creatorId), ensureDefaultShelves(db, creatorId)]);
  return { next };
});
