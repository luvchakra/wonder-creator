import { PROJECT_ITEM_LABEL, PROJECT_STATUS_LABEL, type ProjectCard as ProjectCardData, type ProjectItemKind } from "@wonder/creator-projects/options";
import { Badge, BACKGROUNDS, cn } from "@wonder/ui";
import Link from "next/link";

type Card = Pick<ProjectCardData, "id" | "title" | "brief" | "status" | "counts"> & { coverUrl: string | null; owner?: ProjectCardData["owner"] };

const SHOWN: ProjectItemKind[] = ["artifact", "material", "conversation", "huddle"];

/** A project at a glance: its image, name, status and what's in it. No scores, no percentages. */
export function ProjectCard({ p, className }: { p: Card; className?: string }) {
  const inside = SHOWN.filter((k) => p.counts[k]).map((k) => `${p.counts[k]} ${(p.counts[k] === 1 ? PROJECT_ITEM_LABEL[k].one : PROJECT_ITEM_LABEL[k].many).toLowerCase()}`);
  return (
    <Link href={`/rooms/${p.id}`} className={cn("group block rounded-2xl focus-visible:outline-2", className)}>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-[var(--shadow-card)] transition-shadow group-hover:shadow-[var(--shadow-lift)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.coverUrl ?? BACKGROUNDS.botanicalLeaves} alt="" className={cn("size-full object-cover", !p.coverUrl && "opacity-60")} />
        <Badge tone={p.status === "active" ? "success" : p.status === "archived" ? "neutral" : "accent"} className="absolute left-3 top-3">
          {PROJECT_STATUS_LABEL[p.status]}
        </Badge>
      </div>
      <div className="px-1 pt-2">
        <p className="line-clamp-1 font-medium text-ink">{p.title}</p>
        {p.owner ? <p className="line-clamp-1 text-sm text-accent-ink">Crew · {p.owner.name}&rsquo;s Creative Room</p> : null}
        <p className="line-clamp-1 text-sm text-ink-muted">{inside.length ? inside.join(" · ") : p.brief || "Nothing added yet"}</p>
      </div>
    </Link>
  );
}
