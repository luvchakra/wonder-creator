import { BACKGROUNDS, BrandBackground, KIT, KitArt, Logo, Tagline } from "@wonder/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <BrandBackground src={BACKGROUNDS.archesSea} overlay="soft" className="hidden lg:block" position="center">
        <div className="flex min-h-dvh flex-col justify-end p-12">
          <Tagline className="max-w-md text-5xl leading-[1.1]" />
          <p className="mt-4 max-w-md text-lg text-ink-muted">A place to think, create and bring your creative ideas to life.</p>
        </div>
      </BrandBackground>
      <div className="relative isolate flex flex-col items-center justify-center overflow-hidden bg-[image:var(--gradient-card)] px-5 py-10">
        {/* Vector Kit botanicals, one per corner, behind the form and never over a control. */}
        <KitArt art={KIT.botanical.botanicalSprig2} sizes="(min-width: 640px) 12rem, 8rem" priority className="pointer-events-none absolute -right-6 -top-4 -z-10 h-auto w-32 opacity-90 sm:w-48" />
        <KitArt art={KIT.botanical.botanicalSprig3} sizes="(min-width: 640px) 10rem, 7rem" className="pointer-events-none absolute -bottom-6 -left-6 -z-10 hidden h-auto w-28 -scale-x-100 rotate-180 opacity-80 sm:block sm:w-40" />
        <div className="w-full max-w-sm">
          <Logo height={64} className="mb-2 lg:mb-8" />
          {/* On phones the photo panel (and its tagline) is hidden, so the tagline sits under the logo. */}
          <Tagline className="mb-8 text-xl lg:hidden" />
          {children}
        </div>
      </div>
    </main>
  );
}
