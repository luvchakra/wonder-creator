import type { ScrapbookPost } from "@wonder/creator-library";
import { momentFace, type MomentFace } from "@wonder/creator-library/scrapbook-options";
import { KIT, KitArt, cn } from "@wonder/ui";
import { AudioLines, FileText, Film, Image as ImageIcon, Link2, Lock, Palette, Quote, Sparkles, StickyNote } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/client-time";
import { MomentAudio } from "./client";
import { Waveform, surface } from "./shared";

const ICON: Record<MomentFace, typeof StickyNote> = { note: StickyNote, photo: ImageIcon, audio: AudioLines, quote: Quote, sketch: Palette, inspiration: Sparkles, link: Link2, video: Film, document: FileText };

/** The Moments tab: everyday scraps in their own forms — words stay words, pictures stay pictures. Newest first. */
export function MomentsTab({ posts, isMe }: { posts: ScrapbookPost[]; isMe: boolean }) {
  if (!posts.length)
    return (
      <p className={cn(surface, "px-4 py-6 text-center text-[13.5px] text-ink-muted")}>
        {isMe ? "Notes, photos and voice notes you share to your Scrapbook appear here. " : "Nothing shared here yet."}
        {isMe ? (
          <Link href="/scrapbook" className="font-medium text-accent-ink hover:underline">
            Share a moment
          </Link>
        ) : null}
      </p>
    );
  return (
    <ul aria-label="Moments" className="columns-2 gap-2.5 sm:columns-3 [&>li]:mb-2.5">
      {posts.map((p) => (
        <li key={p.id} className="break-inside-avoid">
          <MomentCard p={p} isMe={isMe} />
        </li>
      ))}
    </ul>
  );
}

function MomentCard({ p, isMe }: { p: ScrapbookPost; isMe: boolean }) {
  const { face, label } = momentFace(p);
  const Icon = ICON[face];
  const a = p.attachments[0];
  const image = a?.fileUrl && a.mimeType?.startsWith("image/") ? a.fileUrl : null;
  const audio = face === "audio" && a?.fileUrl ? a.fileUrl : null;
  const words = p.body.trim();
  return (
    <article className={cn(surface, "relative p-2")} aria-label={`${label}, ${words.slice(0, 60) || a?.title || "moment"}`}>
      <p className="flex items-center gap-1.5 px-0.5 pb-1.5 text-[12px] font-medium text-ink-muted">
        <Icon className="size-3.5 text-accent-ink" aria-hidden />
        <span className="flex-1 truncate">{label}</span>
        {isMe && p.visibility === "private" ? <Lock className="size-3 text-ink-subtle" aria-label="Only you" /> : null}
        <span className="text-[11.5px] font-normal text-ink-subtle">
          <RelativeTime iso={p.createdAt} />
        </span>
      </p>
      {image ? (
        // Signed, short-lived URL for a file the author attached to this entry.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={a!.title} loading="lazy" className="w-full rounded-xl object-cover" />
      ) : null}
      {face === "audio" ? (
        <span className="flex items-center gap-2 py-1">
          {audio ? <MomentAudio src={audio} label={a!.title} /> : <AudioLines className="size-5 text-accent-ink" aria-hidden />}
          <Waveform />
        </span>
      ) : null}
      {face === "link" && a ? (
        <span className="mb-1 flex items-center gap-2 rounded-xl bg-accent-softer px-2.5 py-2 text-[12.5px] text-accent-ink">
          <Link2 className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{a.title}</span>
        </span>
      ) : null}
      {words ? (
        face === "quote" || (face === "note" && !a) ? (
          <p className={cn("relative overflow-hidden rounded-xl px-3 pb-6 pt-2.5 font-display text-[15px] italic leading-snug text-ink", face === "quote" ? "bg-[#f1eeff]" : "bg-[#f8f3ea]")}>
            <KitArt art={face === "quote" ? KIT.painted.lavenderSprig : KIT.painted.leafSprigSage} sizes="3rem" className="pointer-events-none absolute -bottom-2 -right-1 h-14 w-auto opacity-70" />
            <span className="relative line-clamp-6 whitespace-pre-line">{words}</span>
          </p>
        ) : (
          <p className="mt-1.5 line-clamp-3 px-0.5 text-[12.5px] leading-snug text-ink-muted">{words}</p>
        )
      ) : a && !image ? (
        <p className="mt-1 px-0.5 text-[12.5px] text-ink-muted">{a.title}</p>
      ) : null}
      <Link href={`/scrapbook/${p.id}`} className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-accent" aria-label={`Open this ${label.toLowerCase()}`} />
    </article>
  );
}
