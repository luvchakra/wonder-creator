import { StudioScreen, type StudioSearch } from "./screen";

export const metadata = { title: "Creative Studio" };

/** The Creative Studio, for formats without a page of their own yet (creation-pages.md). */
export default async function StudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<StudioSearch> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return <StudioScreen id={id} search={search} at="studio" />;
}
