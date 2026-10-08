import "server-only";
import { addMemory, onboardingMemoryStatements } from "@wonder/creator-brain";
import { getBoundaries, getIdentity, getVoice } from "@wonder/creator-identity";
import type { Db } from "@wonder/db";

/**
 * Creative Memory learns from what the creator says about themselves — disciplines, languages, tone, visual style,
 * what to preserve and avoid. Onboarding used to ask all of it; now it's answered in Settings › Identity and Preferences,
 * whenever the creator gets to it (start-small.md), so this runs after those saves. Each statement lands once:
 * `addMemory` skips an active duplicate. Everything seeded is visible, editable and removable in Creative Memory.
 */
export const PROFILE_MEMORY_LABEL = "Your profile answers";

export async function seedProfileMemories(db: Db, creatorId: string): Promise<void> {
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
  for (const m of statements) await addMemory(db, creatorId, { ...m, sourceKind: "onboarding", sourceLabel: PROFILE_MEMORY_LABEL });
}
