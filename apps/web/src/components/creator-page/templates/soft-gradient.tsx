import { cn } from "@wonder/ui";
import { Art } from "../assets";
import { AboutBlock, ConversationRows, Counts, DejaVuTile, FeaturedWork, Identity, MomentRow, OpenToChips, SectionTitle, Sections, WorkTile, pageModel, type CreatorPageTemplateProps } from "../parts";

const PRESET = {
  lavender: "from-[#ece8fb] via-[#f6f1f8] to-[#fbf3ee]",
  peach: "from-[#fde9de] via-[#fbf1ec] to-[#f6f0f8]",
  sky: "from-[#e3ecfb] via-[#f1f3fa] to-[#f8f1f4]",
} as const;

/**
 * 5 · Soft Gradient & Minimal — modern, airy and the most compact: a pastel gradient, one translucent shape, rounded
 * cards and a simple scanning order. Layers: gradient background + one blob + an optional small branch (spec §34).
 */
export function SoftGradient({ data, settings }: CreatorPageTemplateProps) {
  const m = pageModel(data);
  const handle = data.creator.handle;
  const compact = settings.compactness === "compact";
  const card = settings.cardStyle === "minimal" ? "border border-white/70 bg-white/40" : "bg-white/80 shadow-[0_10px_30px_-18px_rgb(107_91_149/0.35)]";
  const gap = compact ? "space-y-3" : "space-y-5";
  const pad = compact ? "p-3" : "p-4";
  return (
    <div className={cn("relative min-h-full overflow-hidden bg-gradient-to-b text-ink", PRESET[settings.gradientPreset as keyof typeof PRESET] ?? PRESET.lavender)}>
      <Art k="gradient.background" priority sizes="100vw" className={cn("absolute inset-x-0 top-0 h-[38rem] w-full object-cover opacity-80 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]", settings.gradientPreset === "peach" && "hue-rotate-[35deg]", settings.gradientPreset === "sky" && "-hue-rotate-[40deg]")} />
      <Art k="shared.botanical.branch" sizes="12rem" className="absolute right-[-3rem] top-24 h-auto w-48 rotate-[-70deg] opacity-80 @3xl:right-10 @3xl:w-64" />
      <div className={cn("relative mx-auto max-w-5xl px-4 pb-14 pt-8 @3xl:px-8", gap)}>
        <header className={cn("rounded-3xl", card, pad, "@3xl:grid @3xl:grid-cols-[1fr_auto] @3xl:items-end @3xl:gap-6")}>
          <Identity data={data} t="light" avatar={64} statement={m.statement} nameClass="mt-2 text-[26px] @3xl:text-[34px]" />
          <div className="mt-3 @3xl:mt-0 @3xl:min-w-80">
            <Counts counts={m.counts} t="light" className={cn("rounded-2xl py-2", settings.cardStyle === "minimal" ? "bg-white/50" : "bg-white/70")} />
          </div>
        </header>
        <div className={cn("@3xl:grid @3xl:grid-cols-2 @3xl:gap-5", gap, "@3xl:space-y-0")}>
          <Sections
            model={m}
            blocks={{
              dejavu: () => (
                <section aria-label="DejaVu" className={cn("rounded-3xl", card, pad)}>
                  <SectionTitle t="light">DejaVu</SectionTitle>
                  <ul className="grid grid-cols-3 gap-2.5">
                    {m.dejavus.slice(0, 6).map((d, i) => (
                      <li key={d.id}>
                        <DejaVuTile d={d} i={i} handle={handle} t="light" />
                      </li>
                    ))}
                  </ul>
                </section>
              ),
              featured: () => (
                <section aria-label="Featured" className={cn("rounded-3xl @3xl:col-span-2", card, pad)}>
                  <SectionTitle t="light">Featured</SectionTitle>
                  <FeaturedWork w={m.featured!} handle={handle} t="light" />
                </section>
              ),
              creations: () => (
                <section aria-label="Creations" className={cn("rounded-3xl @3xl:col-span-2", card, pad)}>
                  <SectionTitle t="light">Creations</SectionTitle>
                  <ul className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @4xl:grid-cols-4">
                    {m.creations.map((w) => (
                      <li key={w.slug}>
                        <WorkTile w={w} handle={handle} t="light" />
                      </li>
                    ))}
                  </ul>
                </section>
              ),
              moments: () => (
                <section aria-label="Moments" className={cn("rounded-3xl", card, pad)}>
                  <SectionTitle t="light">Moments</SectionTitle>
                  <ul className="divide-y divide-black/5">
                    {m.moments.slice(0, 6).map((x) => (
                      <li key={x.id}>
                        <MomentRow m={x} t="light" />
                      </li>
                    ))}
                  </ul>
                </section>
              ),
              conversations: () => (
                <section aria-label="Open Conversations" className={cn("rounded-3xl", card, pad)}>
                  <SectionTitle t="light">Open Conversations</SectionTitle>
                  <ConversationRows data={data} t="light" />
                </section>
              ),
              about: () => (
                <section aria-label="About" className={cn("rounded-3xl", card, pad)}>
                  <SectionTitle t="light">About</SectionTitle>
                  <AboutBlock data={data} t="light" />
                </section>
              ),
              open_to: () => (
                <section aria-label="Open to" className={cn("rounded-3xl", card, pad)}>
                  <SectionTitle t="light">Open to</SectionTitle>
                  <OpenToChips items={m.openTo} t="light" />
                </section>
              ),
            }}
          />
        </div>
      </div>
    </div>
  );
}
