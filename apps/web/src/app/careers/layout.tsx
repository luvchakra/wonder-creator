import { KIT, KitArt } from "@wonder/ui";
import { SiteFooter, SiteHeader } from "@/components/public/site-chrome";

/** The public careers pages (docs/careers.md): the site's own header and footer on warm paper, no sign-in needed. */
export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-cream text-ink">
      <KitArt art={KIT.texture.texturePaper} priority className="pointer-events-none absolute inset-x-0 top-0 h-[90vh] w-full object-cover opacity-[0.35]" />
      <SiteHeader />
      <main id="main" className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
