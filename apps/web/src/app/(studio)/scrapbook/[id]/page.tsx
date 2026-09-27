import { getPost } from "@wonder/creator-library";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { PostDetail } from "./post-detail";

export const metadata = { title: "Scrapbook" };

export default async function ScrapbookPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const data = await getPost(db, creator.id, id);
  if (!data) notFound();
  return <PostDetail key={data.post.id} initial={data} />;
}
