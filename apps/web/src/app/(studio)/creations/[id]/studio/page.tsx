import { StudioScreen, type StudioSearch } from "./screen";
import { creationTitle } from "./title";

// The Creation's own name (Back elsewhere says "Back to <it>"; back-navigation.md).
export const generateMetadata = ({ params }: { params: Promise<{ id: string }> }) => creationTitle(params, "Creative Studio");

/** The Creative Studio, for formats without a page of their own yet (creation-pages.md). */
export default async function StudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<StudioSearch> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return <StudioScreen id={id} search={search} at="studio" />;
}
