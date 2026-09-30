import { Avatar, cn } from "@wonder/ui";
import { MapPin } from "lucide-react";
import { Art, grainStyle } from "../assets";
import { AboutBlock, ConversationRows, Counts, DejaVuTile, FeaturedWork, MomentRow, OpenToChips, SectionTitle, Sections, WorkTile, pageModel, type CreatorPageTemplateProps } from "../parts";

/**
 * 3 · Cinematic Dark — moody and dramatic, for film, photography, music and night work: a near-black stage, large
 * media, darker surfaces (never white cards) and warm or cool highlights. Layers: dark background + grain + an optional
 * light leak (spec §34). Contrast is checked for every text colour used here (≥ 4.5:1 on the surfaces).
 */
export function CinematicDark({ data, settings }: CreatorPageTemplateProps) {
  const m = pageModel(data);
  const handle = data.creator.handle;
  const cool = settings.accentMode === "cool";
  const accent = cool ? "text-[#9cc1e8]" : "text-[#e9ae6b]";
  const strong = settings.heroContrast === "strong";
  const large = settings.mediaDensity !== "balanced";
  const surface = "rounded-2xl border border-white/6 bg-[#15110e]/90 p-3.5";
  return (
    <div className="relative min-h-full overflow-hidden bg-[#0d0b09] text-[#f3ebe0]">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay" style={grainStyle} />
      <div className="relative h-[27rem] @3xl:h-[32rem]">
        <Art k="cinematic.background" priority sizes="100vw" className={cn("absolute inset-0 size-full object-cover object-[center_35%]", cool && "hue-rotate-[180deg] saturate-50")} />
        {!cool ? <Art k="cinematic.lightLeak" sizes="100vw" className="absolute inset-0 size-full object-cover opacity-25 mix-blend-screen" /> : null}
        <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-b from-transparent to-[#0d0b09]", strong ? "via-black/35" : "via-black/10")} />
        {m.statement ? <p className={cn("absolute left-5 top-8 max-w-[11rem] whitespace-pre-line font-display text-[17px] italic leading-snug [text-shadow:0_1px_12px_rgb(0_0_0/0.9)] @3xl:left-12 @3xl:max-w-xs @3xl:text-[22px]", accent)}>{m.statement}</p> : null}
        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-5xl items-end gap-3 px-5 pb-4 @3xl:px-10">
          <Avatar name={data.creator.name} src={data.creator.avatarUrl ?? undefined} size={68} className="border-2 border-[#f3ebe0]/70" />
          <div className="min-w-0">
            <h1 className="font-display text-[26px] leading-tight @3xl:text-[40px]">{data.creator.name}</h1>
            {data.creator.roles.length ? <p className="text-[13px] text-[#cbbfae]">{data.creator.roles.join(" · ")}</p> : null}
            {data.creator.location ? (
              <p className="inline-flex items-center gap-1 text-[12.5px] text-[#cbbfae]">
                <MapPin className="size-3.5" aria-hidden /> {data.creator.location}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="relative mx-auto max-w-5xl space-y-4 px-4 pb-16 pt-2 @3xl:px-10">
        <Counts counts={m.counts} t="dark" className="rounded-2xl border border-white/8 bg-[#15110e] py-2.5" />
        <Sections
          model={m}
          blocks={{
            dejavu: () => (
              <section aria-label="DejaVu">
                <SectionTitle t="dark">DejaVu</SectionTitle>
                <ul className="grid grid-cols-3 gap-2.5 @3xl:grid-cols-5">
                  {m.dejavus.slice(0, 10).map((d, i) => (
                    <li key={d.id}>
                      <DejaVuTile d={d} i={i} handle={handle} t="dark" />
                    </li>
                  ))}
                </ul>
              </section>
            ),
            featured: () => (
              <section aria-label="Featured" className="relative">
                <SectionTitle t="dark">Featured</SectionTitle>
                <FeaturedWork w={m.featured!} handle={handle} t="dark" className={large ? "" : "@3xl:max-w-2xl"} />
              </section>
            ),
            creations: () => (
              <section aria-label="Creations">
                <SectionTitle t="dark">Creations</SectionTitle>
                <ul className={cn("grid grid-cols-2 gap-3", large ? "@3xl:grid-cols-3" : "@3xl:grid-cols-4")}>
                  {m.creations.map((w) => (
                    <li key={w.slug}>
                      <WorkTile w={w} handle={handle} t="dark" aspect={large ? "aspect-[4/3]" : "aspect-square"} />
                    </li>
                  ))}
                </ul>
              </section>
            ),
            moments: () => (
              <section aria-label="Moments" className={surface}>
                <SectionTitle t="dark">Moments</SectionTitle>
                <ul className="divide-y divide-white/8">
                  {m.moments.slice(0, 6).map((x) => (
                    <li key={x.id}>
                      <MomentRow m={x} t="dark" />
                    </li>
                  ))}
                </ul>
              </section>
            ),
            conversations: () => (
              <section aria-label="Open Conversations">
                <SectionTitle t="dark">Open Conversations</SectionTitle>
                <ConversationRows data={data} t="dark" />
              </section>
            ),
            about: () => (
              <section aria-label="About" className={surface}>
                <SectionTitle t="dark">About</SectionTitle>
                <AboutBlock data={data} t="dark" />
              </section>
            ),
            open_to: () => (
              <section aria-label="Open to">
                <SectionTitle t="dark">Open to</SectionTitle>
                <OpenToChips items={m.openTo} t="dark" />
              </section>
            ),
          }}
        />
      </div>
    </div>
  );
}
