import { addMemory, onboardingMemoryStatements } from "@wonder/creator-brain";
import { DomainError } from "@wonder/core";
import {
  getBoundaries,
  getIdentity,
  getVoice,
  nextOnboardingStep,
  ONBOARDING_STEPS,
  saveAbout,
  saveBoundaries,
  saveIdentity,
  saveVoice,
  setOnboardingStep,
  type OnboardingStep,
} from "@wonder/creator-identity";
import { ensureDefaultShelves } from "@wonder/creator-library";
import { readJson, withApi } from "@/lib/api";

export const POST = withApi<{ step: string }>(async ({ db, creatorId, req }, { step }) => {
  if (!(ONBOARDING_STEPS as readonly string[]).includes(step)) throw new DomainError("not_found", "Unknown step.");
  const s = step as OnboardingStep;
  const body = (await readJson(req)) as { skip?: boolean };
  if (!body.skip) {
    if (s === "about") await saveAbout(db, creatorId, body);
    if (s === "identity") await saveIdentity(db, creatorId, body);
    if (s === "style") await saveVoice(db, creatorId, body);
    if (s === "boundaries") await saveBoundaries(db, creatorId, body);
  } else if (s === "about") {
    throw new DomainError("validation", "Your name and handle help collaborators find you — this step can't be skipped.");
  }
  const next = nextOnboardingStep(s);
  await setOnboardingStep(db, creatorId, next);
  if (next === "complete") {
    // Seed Creative Memory from what the creator told us (visible, editable, removable).
    const [identity, voice, boundaries] = await Promise.all([getIdentity(db, creatorId), getVoice(db, creatorId), getBoundaries(db, creatorId)]);
    const statements = onboardingMemoryStatements({
      disciplines: identity.disciplines,
      languages: identity.languages,
      tones: voice?.tones ?? [],
      writingStyle: voice?.writing_style ?? null,
      visualStyles: voice?.visual_styles ?? [],
      preserve: boundaries.preserve,
      avoid: boundaries.avoid,
    });
    for (const m of statements) await addMemory(db, creatorId, { ...m, sourceKind: "onboarding", sourceLabel: "Your onboarding answers" });
    await ensureDefaultShelves(db, creatorId);
  }
  return { next };
});
