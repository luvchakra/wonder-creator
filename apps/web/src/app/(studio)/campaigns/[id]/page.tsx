import { getCampaign } from "@wonder/creator-projects";
import { notFound } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { requireSession } from "@/lib/session";
import { CampaignView } from "./campaign-view";

export const metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const c = await getCampaign(db, creator.id, id);
  if (!c) notFound();
  const [creations, projects] = await Promise.all([
    c.role === "creator" ? db.from("artifacts").select("id, title").eq("creator_id", creator.id).neq("status", "archived").order("updated_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    c.role === "owner" ? db.from("projects").select("id, title").eq("creator_id", creator.id).order("updated_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
  ]);
  const STATUS: Record<string, string> = { draft: "Draft", open: "Open", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" };
  return (
    <>
      <PaletteScope context={{ page: "global", strip: { label: `${c.campaign.brand_name} · ${STATUS[c.campaign.status] ?? c.campaign.status}` } }} />
      <CampaignView
        me={creator.id}
        data={JSON.parse(JSON.stringify(c))}
        creations={(creations.data ?? []) as Array<{ id: string; title: string }>}
        projects={(projects.data ?? []) as Array<{ id: string; title: string }>}
      />
    </>
  );
}
