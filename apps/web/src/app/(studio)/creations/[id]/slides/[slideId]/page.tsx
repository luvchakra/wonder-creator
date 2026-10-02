import { carouselView } from "@wonder/creator-brain";
import { notFound, redirect } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { requireSession } from "@/lib/session";
import { serviceClient } from "@/lib/supabase/service";
import { SlideEditor } from "./slide-editor";

export const metadata = { title: "Slide" };

/** The focused Slide Editor (docs/ui-redesign/carousel-composer.md §13–27). */
export default async function SlidePage({ params }: { params: Promise<{ id: string; slideId: string }> }) {
  const { id, slideId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(slideId)) notFound();
  const { db, creator } = await requireSession();
  const view = await carouselView({ db, service: serviceClient(), creatorId: creator.id }, id).catch(() => null);
  if (!view) notFound();
  if (!view.slides.some((s) => s.id === slideId)) redirect(`/creations/${id}`);
  return (
    <>
      <PaletteScope context={{ page: "creation", entityType: "creation", lifecycle: "in-progress", permissions: view.isOwner ? ["edit", "publish", "rights", "collaborate", "invite"] : view.canEdit ? ["collaborate"] : [], ids: { artifactId: id } }} />
      <SlideEditor key={slideId} artifactId={id} slideId={slideId} initial={view} />
    </>
  );
}
