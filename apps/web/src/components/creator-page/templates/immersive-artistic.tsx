import { Avatar, cn } from "@wonder/ui";
import { MapPin } from "lucide-react";
import { Art } from "../assets";
import { AboutBlock, ConversationRows, Counts, DejaVuTile, FeaturedWork, MomentRow, OpenToChips, SectionTitle, Sections, WorkTile, pageModel, type CreatorPageTemplateProps } from "../parts";

/**
 * 1 · Immersive Artistic Hero — emotional, painterly, personality-first: the creator's identity sits inside a painted
 * landscape, then the work follows on soft translucent surfaces. Layers: hero + one watercolor wash + one botanical
 * accent + optional mist (spec §34). The hero can be the template painting or the creator's own featured work.
 */
export function ImmersiveArtistic({ data, settings }: CreatorPageTemplateProps) {
  const m = pageModel(data);
  const handle = data.creator.handle;
  const ownCover = settings.heroSource === "creator_cover" ? (m.featured?.coverUrl ?? null) : null;
  const strong = settings.heroContrast === "balanced";
  const roomy = settings.contentDensity === "comfortable";
  const surface = "rounded-2xl bg-white/72 p-3.5 backdrop-blur-md shadow-[0_12px_30px_-20px_rgb(60_40_80/0.5)]";
  return (
    <div className="relative min-h-full overflow-hidden bg-gradient-to-b from-[#4f4a7a] via-[#cdb6cf] to-[#f3e9ee] text-ink">
      <div className="relative h-[34rem] @3xl:h-[36rem]">
        {ownCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ownCover} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <Art k="immersive.hero.primary" priority sizes="100vw" className="absolute inset-0 size-full object-cover object-[center_70%] @3xl:hidden" />
            <Art k="immersive.hero.wide" priority sizes="100vw" className="absolute inset-0 hidden size-full object-cover @3xl:block" />
          </>
        )}
        <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-b", strong ? "from-black/45 via-black/25 to-[#cdb6cf]" : "from-black/30 via-black/10 to-[#cdb6cf]")} />
        <div className="relative mx-auto flex h-full max-w-5xl flex-col justify-end px-5 pb-6 text-white @3xl:px-10">
          <Avatar name={data.creator.name} src={data.creator.avatarUrl ?? undefined} size={72} className="border-2 border-white/80 shadow-lg" />
          <h1 className={cn("mt-3 font-display leading-[1.02] [text-shadow:0_2px_16px_rgb(0_0_0/0.35)]", settings.handwrittenAccent !== false ? "text-[40px] italic @3xl:text-[60px]" : "text-[34px] @3xl:text-[52px]")}>{data.creator.name}</h1>
          {settings.handwrittenAccent !== false ? <Art k="shared.inkScribble" sizes="10rem" className="mt-1 h-auto w-36 opacity-80 invert" /> : null}
          {data.creator.roles.length ? <p className="mt-1 text-[14px] text-white/90">{data.creator.roles.join(" · ")}</p> : null}
          {data.creator.location ? (
            <p className="mt-1 inline-flex items-center gap-1 text-[13px] text-white/85">
              <MapPin className="size-3.5" aria-hidden /> {data.creator.location}
            </p>
          ) : null}
          {m.statement ? <p className="mt-3 max-w-md whitespace-pre-line font-display text-[16px] leading-relaxed text-white/95 [text-shadow:0_1px_10px_rgb(0_0_0/0.4)]">{m.statement}</p> : null}
          <Counts counts={m.counts} t="dark" className="mt-5 max-w-md rounded-2xl bg-black/25 py-2 backdrop-blur-sm [&_dd]:text-white [&_dt]:text-white/80" />
        </div>
      </div>
      <Art k="shared.watercolor.wash" sizes="30rem" className="absolute left-[-6rem] top-[34rem] h-auto w-[28rem] opacity-40" />
      <div className={cn("relative mx-auto max-w-5xl px-4 pb-16 @3xl:grid @3xl:grid-cols-2 @3xl:gap-5 @3xl:px-10", roomy ? "space-y-5" : "space-y-3", "@3xl:space-y-0")}>
        <Sections
          model={m}
          blocks={{
            dejavu: () => (
              <section aria-label="DejaVu" className={surface}>
                <SectionTitle t="glass" serif>
                  DejaVu
                </SectionTitle>
                <ul className="grid grid-cols-3 gap-2.5">
                  {m.dejavus.slice(0, 6).map((d, i) => (
                    <li key={d.id}>
                      <DejaVuTile d={d} i={i} handle={handle} t="glass" />
                    </li>
                  ))}
                </ul>
              </section>
            ),
            featured: () => (
              <section aria-label="Featured" className={cn(surface, "@3xl:col-span-2")}>
                <SectionTitle t="glass" serif>
                  Featured
                </SectionTitle>
                <FeaturedWork w={m.featured!} handle={handle} t="glass" />
              </section>
            ),
            creations: () => (
              <section aria-label="Creations" className={cn(surface, "@3xl:col-span-2")}>
                <SectionTitle t="glass" serif>
                  Creations
                </SectionTitle>
                <ul className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @4xl:grid-cols-4">
                  {m.creations.map((w) => (
                    <li key={w.slug}>
                      <WorkTile w={w} handle={handle} t="glass" />
                    </li>
                  ))}
                </ul>
              </section>
            ),
            moments: () => (
              <section aria-label="Moments" className={surface}>
                <SectionTitle t="glass" serif>
                  Moments
                </SectionTitle>
                <ul className="divide-y divide-black/5">
                  {m.moments.slice(0, 6).map((x) => (
                    <li key={x.id}>
                      <MomentRow m={x} t="glass" />
                    </li>
                  ))}
                </ul>
              </section>
            ),
            conversations: () => (
              <section aria-label="Open Conversations" className={surface}>
                <SectionTitle t="glass" serif>
                  Open Conversations
                </SectionTitle>
                <ConversationRows data={data} t="glass" />
              </section>
            ),
            about: () => (
              <section aria-label="About" className={cn(surface, "relative overflow-hidden pr-24")}>
                <Art k="shared.botanical.branch" sizes="10rem" className="absolute -bottom-6 -right-10 h-auto w-40 rotate-[-60deg] opacity-80" />
                <SectionTitle t="glass" serif>
                  About
                </SectionTitle>
                <AboutBlock data={data} t="glass" />
              </section>
            ),
            open_to: () => (
              <section aria-label="Open to" className={surface}>
                <SectionTitle t="glass" serif>
                  Open to
                </SectionTitle>
                <OpenToChips items={m.openTo} t="glass" />
              </section>
            ),
          }}
        />
      </div>
    </div>
  );
}
