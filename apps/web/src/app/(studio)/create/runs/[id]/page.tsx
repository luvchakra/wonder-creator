import { getRunProgress, providerReadiness } from "@wonder/creator-brain";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { RunView } from "./run-view";

export const metadata = { title: "Creation progress" };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await requireSession();
  const progress = await getRunProgress(db, id).catch(() => null);
  if (!progress) notFound();
  return <RunView initial={progress} providerLive={providerReadiness().live} />;
}
