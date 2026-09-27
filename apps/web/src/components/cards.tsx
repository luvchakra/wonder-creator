import { relativeTime } from "@wonder/core";
import { artifactType } from "@wonder/creator-studio/types";
import { BACKGROUNDS, Badge, cn } from "@wonder/ui";
import { AudioLines, FileText, Film, Globe, Lightbulb, Mic, PlayCircle } from "lucide-react";
import Link from "next/link";

export interface MaterialCardData {
  id: string;
  type: string;
  title: string | null;
  text_content?: string | null;
  created_at: string;
  previewUrl?: string | null;
  metadata?: unknown;
  processing_state?: string;
  source_url?: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  idea: "Idea", note: "Note", text: "Text", voice: "Voice note", image: "Image", sketch: "Sketch", document: "Document", pdf: "PDF",
  audio: "Audio", video: "Video", url: "Link", reference: "Reference", research: "Research", conversation: "Conversation", inspiration: "Inspiration",
};

function Waveform({ className }: { className?: string }) {
  const bars = [4, 9, 14, 7, 18, 11, 22, 9, 15, 6, 19, 12, 8, 16, 10, 5, 13, 20, 9, 6];
  return (
    <div aria-hidden className={cn("flex h-10 items-center gap-[3px]", className)}>
      {bars.map((h, i) => (
        <span key={i} className="w-[3px] rounded-full bg-lavender" style={{ height: h * 1.6 }} />
      ))}
    </div>
  );
}

export function MaterialVisual({ m, className }: { m: MaterialCardData; className?: string }) {
  const meta = (m.metadata ?? {}) as { thumbnailUrl?: string; previewImageUrl?: string; siteName?: string };
  const external = meta.thumbnailUrl ?? meta.previewImageUrl;
  if ((m.type === "image" || m.type === "sketch") && m.previewUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.previewUrl} alt="" className={cn("size-full object-cover", className)} />;
  }
  if ((m.type === "url" || m.type === "reference") && external) {
    return (
      <div className={cn("relative size-full", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={external} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        {m.source_url?.includes("youtu") ? <PlayCircle className="absolute bottom-2 right-2 size-6 text-white drop-shadow" aria-hidden /> : null}
      </div>
    );
  }
  if (m.type === "voice" || m.type === "audio") {
    return (
      <div className={cn("flex size-full items-center justify-center bg-[#f1eeff]", className)}>
        <Waveform />
      </div>
    );
  }
  if (m.type === "video") {
    return (
      <div className={cn("flex size-full items-center justify-center bg-navy/90 text-white", className)}>
        <Film className="size-8" aria-hidden />
      </div>
    );
  }
  if (m.type === "url" || m.type === "reference") {
    return (
      <div className={cn("flex size-full flex-col items-center justify-center gap-1 bg-accent-softer text-accent-ink", className)}>
        <Globe className="size-7" aria-hidden />
        <span className="max-w-[90%] truncate text-xs">{meta.siteName ?? (m.source_url ? new URL(m.source_url).hostname : "")}</span>
      </div>
    );
  }
  if (m.type === "pdf" || m.type === "document") {
    return (
      <div className={cn("flex size-full items-center justify-center bg-[#f7f1e8] text-ink-subtle", className)}>
        <FileText className="size-8" aria-hidden />
      </div>
    );
  }
  // Notes & ideas: a paper-like card with the creator's words.
  return (
    <div className={cn("size-full overflow-hidden bg-[#f8f1e7] p-3", className)}>
      <p className="line-clamp-5 font-display text-[13px] italic leading-snug text-ink-muted">{m.text_content || m.title || "A thought"}</p>
    </div>
  );
}

export function MaterialCard({ m, href }: { m: MaterialCardData; href?: string }) {
  const Icon = m.type === "idea" ? Lightbulb : m.type === "voice" ? Mic : m.type === "audio" ? AudioLines : null;
  const processing = m.processing_state && !["ready", "understood", "failed", "quarantined"].includes(m.processing_state);
  return (
    <Link href={href ?? `/space/materials/${m.id}`} className="group block rounded-2xl focus-visible:outline-2">
      <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-[var(--shadow-card)] transition-shadow group-hover:shadow-[var(--shadow-lift)]">
        <MaterialVisual m={m} />
      </div>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">{m.title || TYPE_LABEL[m.type] || "Untitled"}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-subtle">
          {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
          {TYPE_LABEL[m.type] ?? m.type} · {relativeTime(m.created_at)}
          {processing ? <Badge tone="accent">Processing</Badge> : null}
          {m.processing_state === "failed" ? <Badge tone="warning">Needs attention</Badge> : null}
        </p>
      </div>
    </Link>
  );
}

/**
 * A Materials-wall card (UI redesign §9): photos keep their own shape, notes read like paper, sound and links stay
 * compact. Lazy-loaded; no counts or social signals.
 */
export function MaterialWallCard({ m }: { m: MaterialCardData }) {
  const Icon = m.type === "idea" ? Lightbulb : m.type === "voice" ? Mic : m.type === "audio" ? AudioLines : null;
  const processing = m.processing_state && !["ready", "understood", "failed", "quarantined"].includes(m.processing_state);
  const isPhoto = (m.type === "image" || m.type === "sketch") && m.previewUrl;
  const isPaper = ["idea", "note", "text"].includes(m.type);
  return (
    <Link href={`/space/materials/${m.id}`} className="group block rounded-2xl focus-visible:outline-2">
      <div className="overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-[var(--shadow-card)] transition-shadow group-hover:shadow-[var(--shadow-lift)]">
        {isPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.previewUrl!} alt="" loading="lazy" decoding="async" className="block h-auto min-h-24 w-full object-cover" />
        ) : isPaper ? (
          <div className="bg-[#f8f1e7] p-4">
            <p className="line-clamp-[9] whitespace-pre-line font-display text-[15px] italic leading-snug text-ink-muted">{m.text_content || m.title || "A thought"}</p>
          </div>
        ) : (
          <div className={m.type === "voice" || m.type === "audio" ? "aspect-[3/2]" : "aspect-[4/3]"}>
            <MaterialVisual m={m} />
          </div>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        {/* A note's words are its card; repeating them as a caption adds nothing. */}
        {isPaper && m.text_content ? <span className="sr-only">{m.title || "Note"}</span> : <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{m.title || TYPE_LABEL[m.type] || "Untitled"}</p>}
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-subtle">
          {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
          {TYPE_LABEL[m.type] ?? m.type} · {relativeTime(m.created_at)}
          {processing ? <Badge tone="accent">Processing</Badge> : null}
          {m.processing_state === "failed" ? <Badge tone="warning">Needs attention</Badge> : null}
        </p>
      </div>
    </Link>
  );
}

export interface ArtifactCardData {
  id: string;
  title: string;
  artifact_type: string;
  status: string;
  updated_at: string;
  coverUrl?: string | null;
}

const STATUS_LABEL: Record<string, string> = { draft: "In progress", in_review: "In review", final: "Final", published: "Published", archived: "Archived" };

export function ArtifactCard({ a }: { a: ArtifactCardData }) {
  const def = artifactType(a.artifact_type);
  return (
    <Link href={`/artifacts/${a.id}`} className="group block rounded-2xl focus-visible:outline-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-[var(--shadow-card)] transition-shadow group-hover:shadow-[var(--shadow-lift)]">
        {a.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="relative size-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={def.category === "audio" ? BACKGROUNDS.pastelClouds : def.category === "visual" ? BACKGROUNDS.waves : def.category === "video" ? BACKGROUNDS.sunsetCoast : BACKGROUNDS.softForms} alt="" aria-hidden className="size-full object-cover opacity-80" />
            <p className="absolute inset-x-3 bottom-3 line-clamp-2 font-display text-lg leading-tight text-navy">{a.title}</p>
          </div>
        )}
        <Badge tone={a.status === "final" || a.status === "published" ? "success" : "neutral"} className="absolute left-2 top-2 bg-white/90">
          {STATUS_LABEL[a.status] ?? a.status}
        </Badge>
      </div>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">{a.title}</p>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {def.label} · {relativeTime(a.updated_at)}
        </p>
      </div>
    </Link>
  );
}
