import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

export default async function ProfileRedirect() {
  const { creator } = await requireSession();
  redirect(creator.handle ? `/creators/${creator.handle}` : "/onboarding");
}
