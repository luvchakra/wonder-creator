import { StudioScreen, type StudioSearch } from "../studio/screen";

export const metadata = { title: "Audio" };

/** The Audio page (creation-pages.md §Audio): the recording above the words; Record, Write, Listen; originals kept. */
export default async function AudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<StudioSearch> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return <StudioScreen id={id} search={search} at="audio" />;
}
