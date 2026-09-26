import { getBoundaries, getIdentity, getVoice } from "@wonder/creator-identity";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const s = await requireSession({ allowOnboarding: true });
  if (s.creator.onboarding_step === "complete") redirect("/");
  const [identity, voice, boundaries] = await Promise.all([getIdentity(s.db, s.creator.id), getVoice(s.db, s.creator.id), getBoundaries(s.db, s.creator.id)]);
  return (
    <OnboardingWizard
      initialStep={s.creator.onboarding_step as "welcome"}
      initial={{
        displayName: s.creator.display_name,
        handle: s.creator.handle ?? "",
        bio: s.creator.bio ?? "",
        location: s.creator.location ?? "",
        showLocation: s.creator.show_location,
        languages: identity.languages.length ? identity.languages : ["English"],
        disciplines: identity.disciplines,
        skills: identity.skills,
        interests: identity.interests,
        tones: voice?.tones ?? [],
        writingStyle: voice?.writing_style ?? null,
        formality: voice?.formality ?? null,
        visualStyles: voice?.visual_styles ?? [],
        experimentation: (voice?.experimentation as "balanced") ?? "balanced",
        preserve: boundaries.preserve,
        avoid: boundaries.avoid,
        sensitive: boundaries.sensitive,
      }}
    />
  );
}
