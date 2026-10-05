import { StudioScreen, type StudioSearch } from "../studio/screen";
import { creationTitle } from "../studio/title";

// The Creation's own name (Back elsewhere says "Back to <it>"; back-navigation.md).
export const generateMetadata = ({ params }: { params: Promise<{ id: string }> }) => creationTitle(params, "Audio");

/** The Audio page (creation-pages.md §Audio): the recording above the words; Record, Write, Listen; originals kept. */
export default async function AudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<StudioSearch> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return <StudioScreen id={id} search={search} at="audio" />;
}
