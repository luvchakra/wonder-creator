import { activeStudioSession } from "@wonder/creator-studio";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

/**
 * "Use in Studio" from a Huddle (§34): sends a saved moment to the Creative Studio the creator was last working in.
 * With no Studio open yet, it lands on the Creation list to pick one.
 */
export default async function UseInStudioPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { add } = await searchParams;
  const { db, creator } = await requireSession();
  const active = await activeStudioSession(db, creator.id);
  const safe = add && /^(material|creation|collection|comment|huddle_moment):[0-9a-f-]{36}$/i.test(add) ? add : null;
  if (!active) redirect("/space?tab=creations");
  redirect(`/artifacts/${active.artifactId}/studio${safe ? `?add=${encodeURIComponent(safe)}` : ""}`);
}
