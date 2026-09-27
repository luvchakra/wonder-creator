import { cn } from "@wonder/ui";
import { ArrowDown } from "lucide-react";
import Link from "next/link";
import { MaterialVisual, type MaterialCardData } from "@/components/cards";

/** Pieces of a Creation's surroundings, shared by the Creation view and the Context view (UI redesign §14, §16). */

export interface GraphNode {
  key: string;
  type: string;
  id: string;
  title: string;
  subtitle: string;
  depth: number;
}

export function MaterialGrid({ items, empty }: { items: MaterialCardData[]; empty: string }) {
  if (!items.length) return <p className="rounded-2xl border border-dashed border-border bg-surface/60 px-5 py-6 text-center text-ink-muted">{empty}</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((m) => (
        <li key={m.id}>
          <Link href={`/space/materials/${m.id}`} className="block">
            <div className="aspect-square overflow-hidden rounded-xl border border-border-soft">
              <MaterialVisual m={m} />
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-ink">{m.title || "Untitled"}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const REL_LABEL: Record<string, string> = {
  created_from: "created from",
  derived_from: "derived from",
  adapted_from: "adapted from",
  references: "references",
  contains_material: "contains",
  inspired_by: "inspired by",
  version_of: "version of",
};

export function Lineage({ nodes, edges }: { nodes: GraphNode[]; edges: Array<{ from: string; to: string; relationship: string }> }) {
  const byDepth = new Map<number, GraphNode[]>();
  for (const n of nodes.filter((x) => x.type !== "artifact_version")) byDepth.set(n.depth, [...(byDepth.get(n.depth) ?? []), n]);
  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  if (nodes.length <= 1) return <p className="rounded-2xl border border-dashed border-border bg-surface/60 px-5 py-6 text-center text-ink-muted">This piece started from a blank page. Anything derived from it will appear here.</p>;
  return (
    <ol className="mx-auto max-w-xl space-y-2" aria-label="Creative lineage, from sources to derivatives">
      {depths.map((d, i) => (
        <li key={d}>
          {i > 0 ? (
            <div className="flex justify-center py-1 text-ink-subtle" aria-hidden>
              <ArrowDown className="size-5" />
            </div>
          ) : null}
          <ul className="flex flex-wrap justify-center gap-2">
            {byDepth.get(d)!.map((n) => {
              const rel = edges.find((e) => e.from === n.key || e.to === n.key)?.relationship;
              const inner = (
                <>
                  <p className="text-xs text-ink-subtle">
                    {n.subtitle}
                    {d !== 0 && rel ? ` · ${REL_LABEL[rel] ?? rel}` : ""}
                  </p>
                  <p className="font-medium text-ink">{n.title}</p>
                </>
              );
              const cls = cn("block min-w-44 rounded-2xl border px-4 py-2.5 text-left", d === 0 ? "border-accent bg-accent-softer" : "border-border-soft bg-surface");
              return (
                <li key={n.key}>
                  {n.type === "artifact" && d !== 0 ? (
                    <Link href={`/artifacts/${n.id}`} className={cn(cls, "hover:border-accent")}>
                      {inner}
                    </Link>
                  ) : n.type === "material" ? (
                    <Link href={`/space/materials/${n.id}`} className={cn(cls, "hover:border-accent")}>
                      {inner}
                    </Link>
                  ) : n.type === "conversation" ? (
                    <Link href={`/create?c=${n.id}`} className={cn(cls, "hover:border-accent")}>
                      {inner}
                    </Link>
                  ) : n.type === "collection" && n.subtitle === "Collection" ? (
                    <Link href={`/space/collections/${n.id}`} className={cn(cls, "hover:border-accent")}>
                      {inner}
                    </Link>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
