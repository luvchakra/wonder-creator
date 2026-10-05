import { StudioScreen, type StudioSearch } from "../studio/screen";
import { creationTitle } from "../studio/title";

// The Creation's own name (Back elsewhere says "Back to <it>"; back-navigation.md).
export const generateMetadata = ({ params }: { params: Promise<{ id: string }> }) => creationTitle(params, "Images");

/** The Images page (creation-pages.md §Images): the picture is the work; Edit, Words and Download; originals untouched. */
export default async function ImagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<StudioSearch> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return <StudioScreen id={id} search={search} at="image" />;
}
