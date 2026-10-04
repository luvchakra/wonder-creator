import { StudioScreen, type StudioSearch } from "../studio/screen";

export const metadata = { title: "Writing" };

/** The Writing page (creation-pages.md §Writing): the words, their cover and how they're set; one way to write. */
export default async function WritePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<StudioSearch> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return <StudioScreen id={id} search={search} at="write" />;
}
