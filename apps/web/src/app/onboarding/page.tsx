import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Welcome" };

/** One screen: a name and a handle (start-small.md). A creator left partway through the old wizard lands here too, prefilled. */
export default async function OnboardingPage() {
  const s = await requireSession({ allowOnboarding: true });
  if (s.creator.onboarding_step === "complete") redirect("/");
  return <OnboardingWizard initial={{ displayName: s.creator.display_name, handle: s.creator.handle ?? "" }} />;
}
