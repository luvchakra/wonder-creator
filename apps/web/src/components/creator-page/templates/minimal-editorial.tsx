import { Avatar, cn } from "@wonder/ui";
import { MapPin } from "lucide-react";
import { Art, grainStyle } from "../assets";
import { AboutBlock, ConversationRows, DejaVuTile, FeaturedWork, MomentRow, OpenToChips, SectionTitle, Sections, WorkTile, pageModel, type CreatorPageTemplateProps } from "../parts";

/**
 * 2 · Minimal Editorial Paper — quiet, literary, timeless: a serif title on warm paper, flat sections with thin rules,
 * very few pills and restrained botanicals. Layers: paper + one botanical corner + an optional ink accent (spec §34).
 */
export function MinimalEditorial({ data, settings }: CreatorPageTemplateProps) {
  const m = pageModel(data);
  const handle = data.creator.handle;
  const serif = settings.headingStyle !== "mixed";
  const warm = settings.paperTone !== "neutral";
  const rule = warm ? "border-[#e2d6c3]" : "border-[#e4e1dc]";
  const section = cn("border-t pt-5", rule);
  return (
    <div className={cn("relative min-h-full overflow-hidden text-[#2b241c]", warm ? "bg-[#f6efe3]" : "bg-[#f5f3ef]")}>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={grainStyle} />
      <Art k="editorial.paper.background" priority sizes="100vw" className={cn("absolute inset-x-0 top-0 h-[36rem] w-full object-cover object-top [mask-image:linear-gradient(to_bottom,black_60%,transparent)]", !warm && "saturate-[0.6]")} />
      {settings.botanicalAccent !== "none" ? <Art k="editorial.botanical.corner" sizes="16rem" className="absolute -bottom-6 -right-8 h-auto w-56 opacity-80 @3xl:w-80" /> : null}
      <div className="relative mx-auto max-w-3xl space-y-6 px-5 pb-16 pt-12 @3xl:pt-20">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[34px] leading-[1.05] @3xl:text-[52px]">{data.creator.name}</h1>
            {data.creator.roles.length ? <p className="mt-2 text-[13.5px] tracking-wide text-[#5c5043]">{data.creator.roles.join("  ·  ")}</p> : null}
            {data.creator.location ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-[#7a6d5e]">
                <MapPin className="size-3.5" aria-hidden /> {data.creator.location}
              </p>
            ) : null}
          </div>
          {settings.showCoverImage !== false ? <Avatar name={data.creator.name} src={data.creator.avatarUrl ?? undefined} size={92} className="shrink-0 shadow-[0_10px_24px_-12px_rgb(60_45_30/0.5)]" /> : null}
        </header>
        {m.statement ? <p className="max-w-xl whitespace-pre-line font-display text-[18px] leading-relaxed @3xl:text-[21px]">{m.statement}</p> : null}
        <Art k="shared.inkScribble" sizes="8rem" className="-mt-2 h-auto w-28 opacity-60" />
        <Sections
          model={m}
          blocks={{
            dejavu: () => (
              <section aria-label="DejaVu" className={section}>
                <SectionTitle t="paper" serif={serif}>
                  DejaVu
                </SectionTitle>
                <ul className="grid grid-cols-3 gap-3 @3xl:grid-cols-4">
                  {m.dejavus.slice(0, 8).map((d, i) => (
                    <li key={d.id}>
                      <DejaVuTile d={d} i={i} handle={handle} t="paper" className="[&>span:first-child]:rounded-sm" />
                    </li>
                  ))}
                </ul>
              </section>
            ),
            featured: () => (
              <section aria-label="Featured" className={section}>
                <SectionTitle t="paper" serif={serif}>
                  Featured
                </SectionTitle>
                <FeaturedWork w={m.featured!} handle={handle} t="paper" overlay={false} className="[&_span.rounded-xl]:rounded-sm" />
              </section>
            ),
            creations: () => (
              <section aria-label="Creations" className={section}>
                <SectionTitle t="paper" serif={serif}>
                  Creations
                </SectionTitle>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-5 @xl:grid-cols-3">
                  {m.creations.map((w) => (
                    <li key={w.slug}>
                      <WorkTile w={w} handle={handle} t="paper" className="[&_span.rounded-xl]:rounded-sm" />
                    </li>
                  ))}
                </ul>
              </section>
            ),
            moments: () => (
              <section aria-label="Moments" className={section}>
                <SectionTitle t="paper" serif={serif}>
                  Moments
                </SectionTitle>
                <ul className={cn("divide-y", warm ? "divide-[#e2d6c3]" : "divide-[#e4e1dc]")}>
                  {m.moments.slice(0, 6).map((x) => (
                    <li key={x.id}>
                      <MomentRow m={x} t="paper" />
                    </li>
                  ))}
                </ul>
              </section>
            ),
            conversations: () => (
              <section aria-label="Open Conversations" className={section}>
                <SectionTitle t="paper" serif={serif}>
                  Open Conversations
                </SectionTitle>
                <ConversationRows data={data} t="paper" />
              </section>
            ),
            about: () => (
              <section aria-label="About" className={section}>
                <SectionTitle t="paper" serif={serif}>
                  About
                </SectionTitle>
                <AboutBlock data={data} t="paper" />
              </section>
            ),
            open_to: () => (
              <section aria-label="Open to" className={section}>
                <SectionTitle t="paper" serif={serif}>
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
