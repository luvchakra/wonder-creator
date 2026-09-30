import { Avatar, cn } from "@wonder/ui";
import { MapPin } from "lucide-react";
import { Art, grainStyle } from "../assets";
import { AboutBlock, ConversationRows, DejaVuTile, FeaturedWork, MomentSlip, OpenToChips, SectionTitle, Sections, WorkTile, pageModel, type CreatorPageTemplateProps } from "../parts";

const TILT_MEDIUM = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "rotate-0", "-rotate-1"];
const TILT_LIGHT = ["-rotate-1", "rotate-[0.5deg]", "rotate-0", "rotate-1", "-rotate-[0.5deg]", "rotate-0"];

/**
 * 4 · Creative Collage — handmade, mixed-media, layered: a paper board with taped pieces, small tilts and paper slips.
 * Overlap is controlled and small; the DOM keeps a plain reading order. Layers: paper board + 2–4 tape/paper accents +
 * one note/ink element (spec §34).
 */
export function CreativeCollage({ data, settings }: CreatorPageTemplateProps) {
  const m = pageModel(data);
  const handle = data.creator.handle;
  const tilt = settings.collageIntensity === "medium" ? TILT_MEDIUM : TILT_LIGHT;
  const t = (i: number) => tilt[i % tilt.length];
  const card = "rounded-md bg-[#fbf8f2] p-3 shadow-[0_10px_24px_-14px_rgb(90_70_48/0.45)]";
  return (
    <div className="relative min-h-full overflow-hidden bg-[#ece3d4] text-[#2b241c]">
      {settings.paperTexture !== false ? <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80" style={grainStyle} /> : null}
      <div className="relative h-[24rem] @3xl:h-[28rem]">
        <Art k="collage.paperBoard" priority sizes="100vw" className="absolute inset-0 size-full object-cover object-[center_30%] [mask-image:linear-gradient(to_bottom,black_70%,transparent)]" />
        {settings.handwritingAccent !== false ? <Art k="collage.handwrittenNote" sizes="12rem" className="absolute right-3 top-6 hidden h-auto w-44 rotate-3 @3xl:block" /> : null}
      </div>
      <div className="relative mx-auto -mt-24 max-w-5xl space-y-6 px-4 pb-16 @3xl:px-10">
        <header className={cn(card, "relative flex items-start gap-3 @3xl:max-w-xl", t(1))}>
          <Art k="collage.tape" sizes="8rem" className="absolute -top-5 left-1/2 h-auto w-28 -translate-x-1/2 opacity-90" />
          <Avatar name={data.creator.name} src={data.creator.avatarUrl ?? undefined} size={64} />
          <div className="min-w-0">
            <h1 className="font-display text-[26px] leading-tight @3xl:text-[34px]">{data.creator.name}</h1>
            {data.creator.roles.length ? <p className="text-[13px] text-[#5c5043]">{data.creator.roles.join(" · ")}</p> : null}
            {data.creator.location ? (
              <p className="inline-flex items-center gap-1 text-[12.5px] text-[#7a6d5e]">
                <MapPin className="size-3.5" aria-hidden /> {data.creator.location}
              </p>
            ) : null}
            {m.statement ? <p className="mt-2 whitespace-pre-line font-display text-[15px] italic leading-snug">{m.statement}</p> : null}
          </div>
        </header>
        <Sections
          model={m}
          blocks={{
            dejavu: () => (
              <section aria-label="DejaVu">
                <SectionTitle t="paper" serif>
                  DejaVu
                </SectionTitle>
                <ul className="grid grid-cols-3 gap-3 @3xl:grid-cols-5">
                  {m.dejavus.slice(0, 10).map((d, i) => (
                    <li key={d.id} className={cn("rounded-md bg-[#fbf8f2] p-1.5 shadow-[0_8px_18px_-12px_rgb(90_70_48/0.5)]", t(i))}>
                      <DejaVuTile d={d} i={i} handle={handle} t="paper" className="[&>span:first-child]:rounded-sm" />
                    </li>
                  ))}
                </ul>
              </section>
            ),
            featured: () => (
              <section aria-label="Featured" className={cn(card, "relative", t(3))}>
                <Art k="collage.tornPaper" sizes="14rem" className="absolute -top-4 right-4 h-auto w-40 opacity-90" />
                <SectionTitle t="paper" serif>
                  Featured
                </SectionTitle>
                <FeaturedWork w={m.featured!} handle={handle} t="paper" className="[&_span.rounded-xl]:rounded-sm" />
              </section>
            ),
            creations: () => (
              <section aria-label="Creations">
                <SectionTitle t="paper" serif>
                  Creations
                </SectionTitle>
                <ul className="grid grid-cols-2 gap-4 @xl:grid-cols-3 @4xl:grid-cols-4">
                  {m.creations.map((w, i) => (
                    <li key={w.slug} className={cn("rounded-md bg-[#fbf8f2] p-2 shadow-[0_8px_18px_-12px_rgb(90_70_48/0.5)]", t(i + 2))}>
                      <WorkTile w={w} handle={handle} t="paper" className="[&_span.rounded-xl]:rounded-sm" />
                    </li>
                  ))}
                </ul>
              </section>
            ),
            moments: () => (
              <section aria-label="Moments">
                <SectionTitle t="paper" serif>
                  Moments
                </SectionTitle>
                <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
                  {m.moments.slice(0, 8).map((x, i) => (
                    <li key={x.id} className={t(i + 1)}>
                      <MomentSlip m={x} t="paper" />
                    </li>
                  ))}
                </ul>
              </section>
            ),
            conversations: () => (
              <section aria-label="Open Conversations">
                <SectionTitle t="paper" serif>
                  Open Conversations
                </SectionTitle>
                <ConversationRows data={data} t="paper" />
              </section>
            ),
            about: () => (
              <section aria-label="About" className={cn(card, "relative overflow-hidden pr-20")}>
                <Art k="shared.botanical.branch" sizes="10rem" className="absolute -bottom-4 -right-10 h-auto w-40 rotate-[-65deg] opacity-85" />
                <SectionTitle t="paper" serif>
                  About
                </SectionTitle>
                <AboutBlock data={data} t="paper" />
              </section>
            ),
            open_to: () => (
              <section aria-label="Open to">
                <SectionTitle t="paper" serif>
                  Open to
                </SectionTitle>
                <OpenToChips items={m.openTo} t="paper" />
              </section>
            ),
          }}
        />
      </div>
    </div>
  );
}
