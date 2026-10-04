import { StudioScreen, type StudioSearch } from "../studio/screen";

export const metadata = { title: "Images" };

/** The Images page (creation-pages.md §Images): the picture is the work; Edit, Words and Download; originals untouched. */
export default async function ImagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<StudioSearch> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return <StudioScreen id={id} search={search} at="image" />;
}
