import { BACKGROUNDS, BrandBackground, Logo } from "@wonder/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <BrandBackground src={BACKGROUNDS.archesSea} overlay="soft" className="hidden lg:block" position="center">
        <div className="flex min-h-dvh flex-col justify-end p-12">
          <p className="max-w-md font-display text-5xl leading-[1.1] text-navy">
            Ideas <span className="text-brand-gradient">Become</span> Real.
          </p>
          <p className="mt-4 max-w-md text-lg text-ink-muted">A place to think, create and bring your creative ideas to life.</p>
        </div>
      </BrandBackground>
      <div className="flex flex-col items-center justify-center bg-surface px-5 py-10">
        <div className="w-full max-w-sm">
          <Logo height={64} className="mb-8" />
          {children}
        </div>
      </div>
    </main>
  );
}
