import { StudioScreen, type StudioSearch } from "../studio/screen";
import { creationTitle } from "../studio/title";

// The Creation's own name (Back elsewhere says "Back to <it>"; back-navigation.md).
export const generateMetadata = ({ params }: { params: Promise<{ id: string }> }) => creationTitle(params, "Video");

/** The Video page (creation-pages.md §Video): the storyboard — frames, lines, lengths; Write · Add shot · Play through. */
export default async function VideoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<StudioSearch> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return <StudioScreen id={id} search={search} at="video" />;
}
