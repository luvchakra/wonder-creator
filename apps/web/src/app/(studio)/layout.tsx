import { AppNav } from "@/components/app-nav";
import { avatarUrls } from "@/lib/avatars";
import { requireSession } from "@/lib/session";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const avatars = await avatarUrls(s.db, [s.creator.id]);
  return (
    <>
      <AppNav me={{ name: s.creator.display_name || "You", handle: s.creator.handle, avatarUrl: avatars[s.creator.id] ?? null }} />
      <main id="main" className="relative mx-auto w-full max-w-7xl px-4 pb-[calc(var(--bottom-nav-height)+2rem)] pt-6 sm:px-6 md:pb-16">
        {children}
      </main>
    </>
  );
}
