import { listPosts } from "@wonder/creator-library";
import { PageTitle } from "@wonder/ui";
import { requireSession } from "@/lib/session";
import { ScrapbookFeed } from "./feed";

export const metadata = { title: "Scrapbook" };

export default async function ScrapbookPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { db, creator } = await requireSession();
  const tab = (await searchParams).tab === "following" ? "following" : "everyone";
  const [feed, mats, pieces] = await Promise.all([
    listPosts(db, creator.id, tab === "following" ? { scope: "following", creatorId: creator.id } : { scope: "everyone" }),
    db.from("creative_materials").select("id, title, type").eq("creator_id", creator.id).eq("security_status", "clean").order("created_at", { ascending: false }).limit(30),
    db.from("artifacts").select("id, title, artifact_type").eq("creator_id", creator.id).neq("status", "archived").order("updated_at", { ascending: false }).limit(20),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Scrapbook" subtitle="Thoughts, reflections, sketches and fragments — in the order they were shared. No likes, no rankings." />
      <ScrapbookFeed
        tab={tab}
        initial={feed}
        attachable={{
          materials: (mats.data ?? []).map((m) => ({ id: m.id, title: m.title || "Untitled", type: m.type })),
          pieces: (pieces.data ?? []).map((p) => ({ id: p.id, title: p.title, type: p.artifact_type })),
        }}
      />
    </div>
  );
}
