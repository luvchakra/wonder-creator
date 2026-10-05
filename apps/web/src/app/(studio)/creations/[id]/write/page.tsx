import { StudioScreen, type StudioSearch } from "../studio/screen";
import { creationTitle } from "../studio/title";

// The Creation's own name (Back elsewhere says "Back to <it>"; back-navigation.md).
export const generateMetadata = ({ params }: { params: Promise<{ id: string }> }) => creationTitle(params, "Writing");

/** The Writing page (creation-pages.md §Writing): the words, their cover and how they're set; one way to write. */
export default async function WritePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<StudioSearch> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return <StudioScreen id={id} search={search} at="write" />;
}
