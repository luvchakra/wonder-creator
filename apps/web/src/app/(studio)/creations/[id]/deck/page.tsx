import { StudioScreen, type StudioSearch } from "../studio/screen";
import { creationTitle } from "../studio/title";

// The Creation's own name (Back elsewhere says "Back to <it>"; back-navigation.md).
export const generateMetadata = ({ params }: { params: Promise<{ id: string }> }) => creationTitle(params, "Presentation");

/** The Presentation page (creation-pages.md §Presentation): the current slide large, the strip, Edit slide · Add slide · Present. */
export default async function DeckPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<StudioSearch> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return <StudioScreen id={id} search={search} at="deck" />;
}
