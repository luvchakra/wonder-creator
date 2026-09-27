"use client";
import { RelativeTime } from "@/components/client-time";
import { stepUpErrorMessage, useStepUp } from "@/components/step-up";
import { EXPORT_FORMATS, exportFormatsFor } from "@wonder/creator-studio/exports";
import { ARTIFACT_TYPES, actionsFor } from "@wonder/creator-studio/types";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  Field,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Select,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
  buttonClasses,
  cn,
} from "@wonder/ui";
import { ArrowDown, Check, ChevronRight, CircleAlert, Download, GitBranch, History, MoreHorizontal, PenLine, Radio, RotateCcw, Send, Share2, Shield, Sparkles, Trash2, Users, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MaterialVisual, type MaterialCardData } from "@/components/cards";
import { api, errorMessage } from "@/lib/client";
import { diffLines } from "@/lib/diff";
import { CreateLicenseDialog, OwnerLicenseRequests, RequesterLicensing, type LicenseRequestView } from "./licensing";

interface Version {
  id: string;
  version_number: number;
  label: string;
  content: string;
  change_summary: string | null;
  author_kind: string;
  created_at: string;
}
interface GraphNode {
  key: string;
  type: string;
  id: string;
  title: string;
  subtitle: string;
  depth: number;
}
interface Rights {
  id: string;
  ownership_kind: string;
  copyright_holder: string;
  copyright_registration: string | null;
  attribution_required: boolean;
  derivatives_allowed: boolean;
  notes: string | null;
  rights_owners: Array<{ id: string; owner_name: string; share_percent: number; owner_creator_id: string | null }>;
  licenses: Array<{ id: string; license_type: string; licensee_name: string | null; status: string; territory: string; exclusive: boolean; starts_on: string | null; ends_on: string | null }>;
  events: Array<{ id: string; event: string; created_at: string; title: string; kind: "rights" | "license" | "publication" | "derivative"; derivativeId?: string }>;
}

const LICENSE_LABEL: Record<string, string> = {
  personal: "Personal Use",
  educational: "Educational Use",
  editorial: "Editorial Use",
  promotional: "Promotional Use",
  internal: "Internal Use",
  commercial: "Commercial License",
};

/** Downloads are attachments from the API, not pages: a plain link click keeps the current page. */
function downloadFile(href: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = "";
  link.click();
}

export function ArtifactView(props: {
  artifact: { id: string; title: string; description: string | null; status: string; privacy: string; artifact_type: string; current_version_id: string | null; created_at: string; updated_at: string; featured_on_profile: boolean };
  typeLabel: string;
  isOwner: boolean;
  /** The owner or a collaborator (comment, propose or edit). */
  canCollaborate: boolean;
  owner: { name: string; handle: string | null; avatarUrl: string | null };
  coverUrl: string | null;
  versions: Version[];
  graph: { nodes: GraphNode[]; edges: Array<{ from: string; to: string; relationship: string }> };
  materials: Array<MaterialCardData & { isReference: boolean }>;
  rights: Rights | null;
  rightsDisclaimer: string;
  contributors: Array<{ role: string; name: string; handle: string | null }>;
  quality: { checks: Array<{ key: string; label: string; status: string; note: string }>; suggestions: Array<{ title: string; detail: string }>; createdAt: string } | null;
  initialTab?: string;
  licenseRequests: LicenseRequestView[];
}) {
  const { artifact: a, isOwner } = props;
  const router = useRouter();
  const current = props.versions.find((v) => v.id === a.current_version_id) ?? props.versions[0];
  const [tab, setTab] = useState(["details", "material", "versions", "lineage", "references", "rights"].includes(props.initialTab ?? "") ? props.initialTab! : "details");
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [transformOpen, setTransformOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const createdFrom = props.materials.filter((m) => !m.isReference);
  const references = props.materials.filter((m) => m.isReference);
  const derivedFrom = props.graph.nodes.filter((n) => n.depth < 0 && n.type === "artifact");
  const derivatives = props.graph.nodes.filter((n) => n.depth > 0);

  async function patch(body: Record<string, unknown>) {
    setError(null);
    try {
      await api(`/api/v1/artifacts/${a.id}`, { method: "PATCH", json: body });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1.5fr_1fr]">
        <section aria-label="Preview" className="overflow-hidden rounded-3xl border border-border-soft bg-surface shadow-[var(--shadow-card)]">
          {props.coverUrl ? (
            <div className="relative aspect-[16/8]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={props.coverUrl} alt="" className="size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent" />
              <h1 className="absolute bottom-5 left-6 right-6 font-display text-3xl italic text-white sm:text-4xl">{a.title}</h1>
            </div>
          ) : null}
          <div className="p-5 sm:p-7">
            {!props.coverUrl ? <h1 className="font-display text-3xl text-ink sm:text-4xl">{a.title}</h1> : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge>{props.typeLabel}</Badge>
              <Badge tone={a.status === "final" || a.status === "published" ? "success" : "neutral"}>
                {current ? `v${current.version_number} ` : ""}
                {a.status === "draft" ? "Draft" : a.status === "in_review" ? "In review" : a.status === "final" ? "Final" : a.status}
              </Badge>
              <Badge tone={a.privacy === "public" ? "accent" : "neutral"}>{a.privacy === "public" ? "Public" : a.privacy === "shared" ? "Shared" : "Private"}</Badge>
            </div>
            <article className={cn("mt-5 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-muted p-5 leading-relaxed text-ink", props.typeLabel.match(/Film|Script|Screenplay|Trailer|Dialogue/) ? "font-mono text-[13.5px]" : "font-display text-[17px]")}>
              {current?.content || "This piece is empty. Open the Studio to start writing."}
            </article>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {isOwner ? (
              <>
                <Link href={`/artifacts/${a.id}/studio`} className={buttonClasses({})}>
                  <PenLine className="size-4" aria-hidden /> Edit
                </Link>
                <Button variant="secondary" onClick={() => setShareOpen(true)}>
                  <Share2 className="size-4" aria-hidden /> Share
                </Button>
                <Link href={`/artifacts/${a.id}/publish`} className={buttonClasses({ variant: "secondary" })}>
                  <Send className="size-4" aria-hidden /> Publish
                </Link>
              </>
            ) : null}
            <Menu>
              <MenuTrigger className={buttonClasses({ variant: "secondary" })}>
                <Download className="size-4" aria-hidden /> Download
              </MenuTrigger>
              <MenuContent align="start">
                {exportFormatsFor(a.artifact_type).map((f) => (
                  <MenuItem key={f} onSelect={() => downloadFile(`/api/v1/artifacts/${a.id}/export?format=${f}`)}>
                    {EXPORT_FORMATS[f].label} (.{EXPORT_FORMATS[f].ext})
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
            {props.canCollaborate ? (
              <Link href={`/artifacts/${a.id}/collaborate`} className={buttonClasses({ variant: "secondary" })}>
                <Users className="size-4" aria-hidden /> Collaborate
              </Link>
            ) : null}
            {isOwner ? (
              <Menu>
                <MenuTrigger className={buttonClasses({ variant: "ghost", className: "px-3" })} aria-label="More actions">
                  <MoreHorizontal className="size-5" aria-hidden />
                </MenuTrigger>
                <MenuContent>
                  <MenuItem onSelect={() => setTransformOpen(true)}>
                    <Wand2 className="size-4" aria-hidden /> Transform / create derivative
                  </MenuItem>
                  <MenuItem onSelect={() => router.push(`/create?artifact=${a.id}`)}>
                    <Sparkles className="size-4" aria-hidden /> Talk about this piece
                  </MenuItem>
                  <MenuItem onSelect={() => router.push(`/huddles?artifact=${a.id}`)}>
                    <Radio className="size-4" aria-hidden /> Start a Huddle about this
                  </MenuItem>
                  {a.status !== "archived" ? (
                    <MenuItem onSelect={() => patch({ status: "archived" })}>
                      <History className="size-4" aria-hidden /> Archive
                    </MenuItem>
                  ) : (
                    <MenuItem onSelect={() => patch({ status: "draft" })}>
                      <History className="size-4" aria-hidden /> Restore from archive
                    </MenuItem>
                  )}
                  <MenuItem destructive onSelect={() => setDeleteOpen(true)}>
                    <Trash2 className="size-4" aria-hidden /> Delete permanently
                  </MenuItem>
                </MenuContent>
              </Menu>
            ) : null}
          </div>

          <section className="rounded-2xl border border-border-soft bg-surface p-5">
            <h2 className="font-semibold text-ink">About this artifact</h2>
            <p className="mt-1.5 text-[15px] text-ink-muted">{a.description || "No description yet."}</p>
            <h3 className="mt-4 text-sm font-medium text-ink-subtle">Created by</h3>
            <div className="mt-1.5 flex items-center gap-2.5">
              <Avatar name={props.owner.name} src={props.owner.avatarUrl} size={36} />
              <div>
                <p className="text-[15px] font-medium text-ink">{props.owner.name}</p>
                <p className="text-xs text-ink-subtle">{new Date(a.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            </div>
            {props.contributors.length ? (
              <>
                <h3 className="mt-4 text-sm font-medium text-ink-subtle">Collaborators</h3>
                <ul className="mt-1 space-y-1 text-sm text-ink">
                  {props.contributors.map((c) => (
                    <li key={`${c.name}${c.role}`}>
                      {c.name} <span className="text-ink-subtle">· {c.role}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-ink-subtle">Created from</dt>
              <dd className="text-ink">
                {derivedFrom.length ? (
                  <Link href={`/artifacts/${derivedFrom[0].id}`} className="text-accent-ink hover:underline">
                    “{derivedFrom[0].title}”
                  </Link>
                ) : createdFrom.length ? (
                  `${createdFrom.length} material${createdFrom.length === 1 ? "" : "s"}`
                ) : (
                  "A blank page"
                )}
              </dd>
              <dt className="text-ink-subtle">Version</dt>
              <dd className="text-ink">
                v{current?.version_number ?? 1} · {props.versions.length} total
              </dd>
              <dt className="text-ink-subtle">Visibility</dt>
              <dd className="text-ink">{a.privacy === "public" ? "Public" : "Private"}</dd>
              <dt className="text-ink-subtle">Rights</dt>
              <dd className="text-ink">{props.rights ? (props.rights.ownership_kind === "joint" ? "Joint ownership" : "All rights reserved") : "—"}</dd>
            </dl>
          </section>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </aside>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabList label="Artifact sections">
          <Tab value="details">Details</Tab>
          <Tab value="material">Material ({createdFrom.length})</Tab>
          <Tab value="versions">Versions ({props.versions.length})</Tab>
          <Tab value="lineage">Lineage</Tab>
          <Tab value="references">References ({references.length})</Tab>
          <Tab value="rights">Rights</Tab>
        </TabList>

        <TabPanel value="details">
          <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-2">
            <section className="rounded-2xl border border-border-soft bg-surface p-5">
              <h2 className="font-semibold text-ink">Quality</h2>
              {props.quality ? (
                <>
                  <ul className="mt-3 space-y-2 text-sm">
                    {props.quality.checks.map((c) => (
                      <li key={c.key} className="flex items-start gap-2">
                        {c.status === "good" ? <Check className="mt-0.5 size-4 shrink-0 text-success-ink" aria-label="Good" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-label="Worth a look" />}
                        <span>
                          <span className="font-medium text-ink">{c.label}</span> <span className="text-ink-muted">— {c.note}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {props.quality.suggestions.length ? (
                    <>
                      <h3 className="mt-4 text-sm font-medium text-ink">Suggestions to consider</h3>
                      <ul className="mt-1 space-y-1 text-sm text-ink-muted">
                        {props.quality.suggestions.map((s) => (
                          <li key={s.title}>
                            <span className="font-medium text-ink">{s.title}:</span> {s.detail}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  <p className="mt-3 text-xs text-ink-subtle">Suggestions only — nothing was rewritten. Checked <RelativeTime iso={props.quality.createdAt} />.</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">No quality review yet. Run one from the Studio.</p>
              )}
            </section>
            <section className="rounded-2xl border border-border-soft bg-surface p-5">
              <h2 className="font-semibold text-ink">What you can do next</h2>
              <ul className="mt-3 space-y-1">
                {actionsFor(a.artifact_type)
                  .filter((x) => x.kind === "transform")
                  .map((x) => (
                    <li key={x.key}>
                      <Link href={`/artifacts/${a.id}/studio?action=${x.key}`} className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-[15px] text-ink hover:bg-surface-muted">
                        <Wand2 className="size-4 text-accent-ink" aria-hidden /> {x.label}
                        <span className="text-sm text-ink-subtle">— {x.hint}</span>
                      </Link>
                    </li>
                  ))}
                {derivatives.length ? (
                  <li className="pt-2 text-sm text-ink-muted">
                    Derived pieces:{" "}
                    {derivatives.map((d, i) => (
                      <span key={d.key}>
                        {i ? ", " : ""}
                        <Link className="font-medium text-accent-ink hover:underline" href={`/artifacts/${d.id}`}>
                          {d.title}
                        </Link>
                      </span>
                    ))}
                  </li>
                ) : null}
              </ul>
            </section>
          </div>
        </TabPanel>

        <TabPanel value="material">
          <MaterialGrid items={createdFrom} empty="This piece wasn't made from saved material." />
        </TabPanel>

        <TabPanel value="versions">
          <Versions artifactId={a.id} versions={props.versions} currentId={a.current_version_id} isOwner={isOwner} />
        </TabPanel>

        <TabPanel value="lineage">
          <Lineage nodes={props.graph.nodes} edges={props.graph.edges} />
        </TabPanel>

        <TabPanel value="references">
          <MaterialGrid items={references} empty="No references were attached when this was created. Attach references from your Reference Shelf in CreatorTalk." />
        </TabPanel>

        <TabPanel value="rights">
          <RightsPanel
            artifactId={a.id}
            rights={props.rights}
            disclaimer={props.rightsDisclaimer}
            isOwner={isOwner}
            contributors={props.contributors}
            provenance={{ derivedFrom: derivedFrom[0] ? { id: derivedFrom[0].id, title: derivedFrom[0].title } : null, materials: createdFrom.length, references: references.length }}
            licenseRequests={props.licenseRequests}
            title={a.privacy === "public" && (a.status === "final" || a.status === "published") ? a.title : null}
          />
        </TabPanel>
      </Tabs>

      {isOwner ? (
        <>
          <ShareDialog key={shareOpen ? "open" : "closed"} open={shareOpen} onOpenChange={setShareOpen} artifact={a} onSave={patch} />
          <TransformDialog
            open={transformOpen}
            onOpenChange={setTransformOpen}
            artifactId={a.id}
            currentType={a.artifact_type}
            source={{
              title: a.title,
              currentVersionId: a.current_version_id,
              versions: props.versions.map((v) => ({ id: v.id, number: v.version_number, label: v.label })),
              materials: props.materials.length,
              contributors: props.contributors.map((c) => `${c.name} (${c.role})`),
              rights: props.rights ? { ownershipKind: props.rights.ownership_kind, owners: props.rights.rights_owners.map((o) => o.owner_name), attributionRequired: props.rights.attribution_required } : null,
            }}
          />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            destructive
            busy={busy}
            title="Delete this piece permanently?"
            body="All versions, lineage and rights records for this piece will be removed. Your source material stays safe. This can't be undone."
            confirmLabel="Delete permanently"
            onConfirm={async () => {
              setBusy(true);
              try {
                await api(`/api/v1/artifacts/${a.id}?confirm=true`, { method: "DELETE" });
                router.replace("/space");
              } catch (e) {
                setError(errorMessage(e));
                setBusy(false);
                setDeleteOpen(false);
              }
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function MaterialGrid({ items, empty }: { items: MaterialCardData[]; empty: string }) {
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

function Versions({ artifactId, versions, currentId, isOwner }: { artifactId: string; versions: Version[]; currentId: string | null; isOwner: boolean }) {
  const router = useRouter();
  const [left, setLeft] = useState(versions[1]?.id ?? versions[0]?.id);
  const [right, setRight] = useState(versions[0]?.id);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const diff = useMemo(() => {
    const l = versions.find((v) => v.id === left);
    const r = versions.find((v) => v.id === right);
    return l && r && l.id !== r.id ? diffLines(l.content, r.content) : null;
  }, [left, right, versions]);

  return (
    <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_1.4fr]">
      <ol className="relative space-y-3 border-l-2 border-border-soft pl-5" aria-label="Version history">
        {versions.map((v) => (
          <li key={v.id} className="relative rounded-2xl border border-border-soft bg-surface p-4">
            <span aria-hidden className={cn("absolute -left-[29px] top-5 size-3.5 rounded-full border-2 border-white", v.id === currentId ? "bg-accent" : "bg-light-gray")} />
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-ink">
                v{v.version_number} {v.label}
              </p>
              {v.id === currentId ? <Badge tone="accent">Current</Badge> : null}
              <Badge>{v.author_kind === "ai" ? "CreatorBrain" : v.author_kind === "restore" ? "Restored" : "You"}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-ink-subtle"><RelativeTime iso={v.created_at} /></p>
            {v.change_summary ? <p className="mt-1.5 text-sm text-ink-muted">{v.change_summary}</p> : null}
            {isOwner && v.id !== currentId ? (
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                loading={restoring === v.id}
                onClick={async () => {
                  setRestoring(v.id);
                  setError(null);
                  try {
                    await api(`/api/v1/artifacts/${artifactId}/restore`, { method: "POST", json: { versionId: v.id } });
                    router.refresh();
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setRestoring(null);
                  }
                }}
              >
                <RotateCcw className="size-4" aria-hidden /> Restore as new version
              </Button>
            ) : null}
          </li>
        ))}
        {error ? <li className="text-sm text-danger">{error}</li> : null}
      </ol>
      <section aria-label="Compare versions" className="rounded-2xl border border-border-soft bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Compare" htmlFor="left" className="min-w-36 flex-1">
            <Select id="left" value={left} onChange={(e) => setLeft(e.target.value)}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="with" htmlFor="right" className="min-w-36 flex-1">
            <Select id="right" value={right} onChange={(e) => setRight(e.target.value)}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} {v.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4 max-h-[28rem] overflow-auto rounded-xl bg-surface-muted p-3 font-mono text-[13px] leading-relaxed">
          {diff ? (
            diff.map((d, i) => (
              <div key={i} className={cn("whitespace-pre-wrap px-2", d.kind === "added" && "bg-success-soft text-success-ink", d.kind === "removed" && "bg-danger-soft text-danger line-through decoration-danger/40")}>
                <span aria-hidden className="mr-2 select-none opacity-60">
                  {d.kind === "added" ? "+" : d.kind === "removed" ? "−" : " "}
                </span>
                <span className="sr-only">{d.kind === "added" ? "Added: " : d.kind === "removed" ? "Removed: " : ""}</span>
                {d.text || " "}
              </div>
            ))
          ) : (
            <p className="p-2 font-sans text-sm text-ink-muted">Choose two different versions to compare.</p>
          )}
        </div>
      </section>
    </div>
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

function Lineage({ nodes, edges }: { nodes: GraphNode[]; edges: Array<{ from: string; to: string; relationship: string }> }) {
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

function ShareDialog({
  open,
  onOpenChange,
  artifact,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  artifact: { id: string; privacy: string; status: string; featured_on_profile: boolean };
  onSave: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [pub, setPub] = useState(artifact.privacy === "public");
  const [final, setFinal] = useState(artifact.status === "final" || artifact.status === "published");
  const [featured, setFeatured] = useState(artifact.featured_on_profile);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Share" description="Choose who can see this piece. Private by default.">
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium text-ink">Mark as final</span>
              <span className="text-sm text-ink-muted">Only final pieces can be shown publicly.</span>
            </span>
            <Switch checked={final} onCheckedChange={setFinal} label="Mark as final" />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium text-ink">Public</span>
              <span className="text-sm text-ink-muted">Visible on your profile to people who can see it. Your source material stays private.</span>
            </span>
            <Switch checked={pub} onCheckedChange={setPub} label="Public" />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium text-ink">Feature on my profile</span>
              <span className="text-sm text-ink-muted">Show it among your selected work.</span>
            </span>
            <Switch checked={featured} onCheckedChange={setFeatured} label="Feature on my profile" disabled={!pub} />
          </label>
          {pub && !final ? <p className="text-sm text-warning-ink">Drafts stay private even when set to public — mark it final to share it.</p> : null}
          <Link href={`/artifacts/${artifact.id}/share`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border-soft px-4 py-2 hover:bg-black/[0.02]">
            <span>
              <span className="block font-medium text-ink">Private links and people</span>
              <span className="text-sm text-ink-muted">Share without publishing: a link, or named creators. Revoke any time.</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
          </Link>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await onSave({ privacy: pub ? "public" : "creator_private", status: final ? "final" : "draft", featuredOnProfile: pub && featured });
                setBusy(false);
                onOpenChange(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** What a derivative inherits, shown before it's made. */
export interface TransformSource {
  title: string;
  currentVersionId: string | null;
  versions: Array<{ id: string; number: number; label: string }>;
  materials: number;
  contributors: string[];
  rights: { ownershipKind: string; owners: string[]; attributionRequired: boolean } | null;
}

export function TransformDialog({
  open,
  onOpenChange,
  artifactId,
  currentType,
  initialType,
  source,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  artifactId: string;
  currentType: string;
  initialType?: string;
  source?: TransformSource;
}) {
  const router = useRouter();
  const [type, setType] = useState(initialType ?? "");
  const [instruction, setInstruction] = useState("");
  const [versionId, setVersionId] = useState(source?.currentVersionId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggested = actionsFor(currentType).filter((a) => a.kind === "transform" && a.targetType);
  const others = ARTIFACT_TYPES.filter((t) => t.type !== currentType && !suggested.some((s) => s.targetType === t.type));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Create a derivative" description="A new piece adapted from this one. The original stays unchanged and the new piece records where it came from." wide>
        {source ? (
          <div className="rounded-2xl bg-surface-muted p-3 text-sm">
            <p className="text-ink">
              From <span className="font-medium">“{source.title}”</span>
            </p>
            {source.versions.length > 1 ? (
              <Field label="Version to adapt" htmlFor="source-version" className="mt-2">
                <Select id="source-version" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
                  {source.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.number} {v.label}
                      {v.id === source.currentVersionId ? " (current)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
        ) : null}

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-ink">Turn it into</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {suggested.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={type === s.targetType}
                onClick={() => setType(s.targetType!)}
                className={cn("flex min-h-16 flex-col items-start justify-center rounded-2xl border px-4 py-2 text-left text-sm", type === s.targetType ? "border-accent bg-accent-soft text-accent-ink" : "border-border text-ink hover:border-[#cfd0ff]")}
              >
                <span className="font-medium">{s.label}</span>
                <span className="text-xs text-ink-subtle">{artifactTypeLabel(s.targetType!)}</span>
              </button>
            ))}
          </div>
          <details className="mt-3" open={!!type && !suggested.some((s) => s.targetType === type)}>
            <summary className="cursor-pointer text-sm text-accent-ink">More kinds of piece</summary>
            <Field label="Any kind of piece" htmlFor="target" className="mt-2">
              <Select id="target" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Choose…</option>
                {others.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label} — {t.description}
                  </option>
                ))}
              </Select>
            </Field>
          </details>
        </fieldset>

        <Field label="Anything to keep in mind? (optional)" htmlFor="instr" className="mt-4">
          <Textarea id="instr" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Keep the opening image; make it feel like a lullaby." />
        </Field>

        {source ? (
          <section aria-label="What carries over" className="mt-4 rounded-2xl border border-border-soft p-3 text-sm">
            <p className="font-medium text-ink">What carries over</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-muted">
              <li>A link back to this piece and the version you chose.</li>
              <li>{source.materials ? `${source.materials} piece${source.materials === 1 ? "" : "s"} of material it was made from.` : "No material was attached to this piece."}</li>
              {source.contributors.length ? <li>Contributors: {source.contributors.join(", ")}.</li> : null}
              {source.rights ? (
                <li>
                  Rights: {source.rights.ownershipKind === "joint" ? `jointly owned (${source.rights.owners.join(", ")})` : "your ownership"}
                  {source.rights.attributionRequired ? ", attribution required" : ""}.
                </li>
              ) : null}
              <li>The new piece starts as a private draft — you review it before sharing or publishing.</li>
            </ul>
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!type}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await api<{ artifact: { id: string } }>(`/api/v1/artifacts/${artifactId}/transform`, { method: "POST", json: { targetType: type, instruction, versionId: versionId || null } });
                router.push(`/artifacts/${r.artifact.id}`);
              } catch (e) {
                setError(errorMessage(e));
                setBusy(false);
              }
            }}
          >
            <GitBranch className="size-4" aria-hidden /> Create derivative
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function artifactTypeLabel(type: string): string {
  return ARTIFACT_TYPES.find((t) => t.type === type)?.description ?? "";
}

function RightsPanel({
  artifactId,
  rights,
  disclaimer,
  isOwner,
  contributors,
  provenance,
  licenseRequests,
  title,
}: {
  artifactId: string;
  licenseRequests: LicenseRequestView[];
  title: string | null;
  rights: Rights | null;
  disclaimer: string;
  isOwner: boolean;
  contributors: Array<{ role: string; name: string; handle: string | null }>;
  provenance: { derivedFrom: { id: string; title: string } | null; materials: number; references: number };
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "rights" | "license" | "publication" | "derivative">("all");
  const [error, setError] = useState<string | null>(null);
  const stepUp = useStepUp();
  const [form, setForm] = useState(() => ({
    ownershipKind: rights?.ownership_kind ?? "sole",
    copyrightHolder: rights?.copyright_holder ?? "",
    copyrightRegistration: rights?.copyright_registration ?? "",
    attributionRequired: rights?.attribution_required ?? true,
    derivativesAllowed: rights?.derivatives_allowed ?? false,
    notes: rights?.notes ?? "",
    owners: (rights?.rights_owners ?? []).map((o) => ({ name: o.owner_name, sharePercent: Number(o.share_percent), creatorId: o.owner_creator_id })),
  }));
  if (!rights) return <p className="text-ink-muted">Rights details are only visible to the creator.</p>;
  const history = historyFilter === "all" ? rights.events : rights.events.filter((e) => e.kind === historyFilter);
  const total = form.owners.reduce((s, o) => s + (Number(o.sharePercent) || 0), 0);

  return (
    <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[1.2fr_1fr]">
      {stepUp.dialog}
      <p role="note" className="rounded-2xl border border-[#f6dfb6] bg-warning-soft px-4 py-3 text-sm text-warning-ink lg:col-span-full">
        {disclaimer}
      </p>
      <section className="rounded-2xl border border-border-soft bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <Shield className="size-5 text-accent-ink" aria-hidden /> Rights summary
          </h2>
          {isOwner && !edit ? (
            <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>
              Edit
            </Button>
          ) : null}
        </div>
        {!edit ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-surface-muted p-3">
              <dt className="text-xs text-ink-subtle">Ownership</dt>
              <dd className="mt-1 text-sm text-ink">
                {rights.rights_owners.map((o) => `${o.owner_name} (${Number(o.share_percent)}%)`).join(", ")}
                <span className="block text-xs text-ink-subtle">{rights.ownership_kind === "joint" ? "Joint ownership" : rights.ownership_kind === "transferred" ? "Transferred" : "Full ownership"}</span>
              </dd>
            </div>
            <div className="rounded-xl bg-surface-muted p-3">
              <dt className="text-xs text-ink-subtle">Copyright</dt>
              <dd className="mt-1 text-sm text-ink">
                {rights.copyright_holder}
                <span className="block text-xs text-ink-subtle">{rights.copyright_registration ? `Registered: ${rights.copyright_registration}` : "Not registered (optional)"}</span>
              </dd>
            </div>
            <div className="rounded-xl bg-surface-muted p-3">
              <dt className="text-xs text-ink-subtle">Use</dt>
              <dd className="mt-1 text-sm text-ink">
                {rights.attribution_required ? "Attribution required" : "No attribution required"}
                <span className="block text-xs text-ink-subtle">{rights.derivatives_allowed ? "Derivatives allowed" : "No derivatives by others"}</span>
              </dd>
            </div>
            {rights.notes ? (
              <div className="rounded-xl bg-surface-muted p-3 sm:col-span-full">
                <dt className="text-xs text-ink-subtle">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">{rights.notes}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <form
            className="mt-4 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                // Transferring ownership asks for the password (step-up); other edits save directly.
                await stepUp.run((password) =>
                  api(`/api/v1/artifacts/${artifactId}/rights`, { method: "PUT", json: { ...form, owners: form.owners.map((o) => ({ ...o, sharePercent: Number(o.sharePercent) })), password } }).then(() => undefined),
                );
                setEdit(false);
                router.refresh();
              } catch (err) {
                setError(stepUpErrorMessage(err));
              }
            }}
          >
            <Field label="Ownership" htmlFor="own">
              <Select id="own" value={form.ownershipKind} onChange={(e) => setForm({ ...form, ownershipKind: e.target.value })}>
                <option value="sole">Sole ownership</option>
                <option value="joint">Joint ownership</option>
                <option value="transferred">Transferred</option>
              </Select>
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ink">Owners {total !== 100 ? <span className="text-danger">(shares total {total}%, must be 100%)</span> : null}</legend>
              {form.owners.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <Input aria-label={`Owner ${i + 1} name`} value={o.name} onChange={(e) => setForm({ ...form, owners: form.owners.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  <Input aria-label={`Owner ${i + 1} share percent`} type="number" min={1} max={100} className="w-24" value={o.sharePercent} onChange={(e) => setForm({ ...form, owners: form.owners.map((x, j) => (j === i ? { ...x, sharePercent: Number(e.target.value) } : x)) })} />
                  {form.owners.length > 1 ? (
                    <Button variant="ghost" aria-label={`Remove owner ${i + 1}`} onClick={() => setForm({ ...form, owners: form.owners.filter((_, j) => j !== i) })}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, owners: [...form.owners, { name: "", sharePercent: 0, creatorId: null }] })}>
                + Add owner
              </Button>
            </fieldset>
            <Field label="Copyright holder" htmlFor="holder">
              <Input id="holder" value={form.copyrightHolder} onChange={(e) => setForm({ ...form, copyrightHolder: e.target.value })} />
            </Field>
            <Field label="Registration (optional)" htmlFor="reg">
              <Input id="reg" value={form.copyrightRegistration} onChange={(e) => setForm({ ...form, copyrightRegistration: e.target.value })} />
            </Field>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink">Attribution required</span>
              <Switch checked={form.attributionRequired} onCheckedChange={(v) => setForm({ ...form, attributionRequired: v })} label="Attribution required" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink">Allow derivative works by others</span>
              <Switch checked={form.derivativesAllowed} onCheckedChange={(v) => setForm({ ...form, derivativesAllowed: v })} label="Allow derivative works" />
            </label>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEdit(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={total !== 100}>
                Save rights
              </Button>
            </div>
          </form>
        )}
        {!edit ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-muted p-3">
              <dt className="text-xs text-ink-subtle">Contributors</dt>
              <dd className="mt-1 text-sm text-ink">{contributors.length ? contributors.map((c) => `${c.name} (${c.role})`).join(", ") : "Only you"}</dd>
            </div>
            <div className="rounded-xl bg-surface-muted p-3">
              <dt className="text-xs text-ink-subtle">Provenance</dt>
              <dd className="mt-1 text-sm text-ink">
                {provenance.derivedFrom ? (
                  <>
                    Derived from{" "}
                    <Link href={`/artifacts/${provenance.derivedFrom.id}`} className="text-accent-ink hover:underline">
                      “{provenance.derivedFrom.title}”
                    </Link>
                  </>
                ) : provenance.materials ? (
                  `Made from ${provenance.materials} piece${provenance.materials === 1 ? "" : "s"} of your material`
                ) : (
                  "Made from scratch"
                )}
                {provenance.references ? <span className="block text-xs text-ink-subtle">{provenance.references} reference{provenance.references === 1 ? "" : "s"}</span> : null}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border-soft bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">Licenses</h2>
          {isOwner ? (
            <Button size="sm" variant="secondary" onClick={() => setLicenseOpen(true)}>
              Add license
            </Button>
          ) : null}
        </div>
        {rights.licenses.length ? (
          <ul className="mt-3 space-y-2">
            {rights.licenses.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-muted p-3 text-sm">
                <span>
                  <span className="font-medium text-ink">{LICENSE_LABEL[l.license_type]}</span>
                  <span className="block text-xs text-ink-subtle">
                    {l.licensee_name || "Any licensee"} · {l.territory}
                    {l.exclusive ? " · Exclusive" : ""}
                    {l.ends_on ? ` · until ${l.ends_on}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={l.status === "active" ? "success" : l.status === "revoked" ? "danger" : "neutral"}>{l.status}</Badge>
                  {isOwner && l.status !== "revoked" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          // Activating a commercial license asks for the password (step-up).
                          await stepUp.run((password) => api(`/api/v1/licenses/${l.id}`, { method: "PATCH", json: { status: l.status === "active" ? "revoked" : "active", password } }).then(() => undefined));
                          router.refresh();
                        } catch (e) {
                          setError(stepUpErrorMessage(e));
                        }
                      }}
                    >
                      {l.status === "active" ? "Revoke" : "Activate"}
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">No licenses. Personal viewing only.</p>
        )}
      </section>
      <section className={cn("rounded-2xl border border-border-soft bg-surface p-5 lg:col-span-full", !isOwner && "hidden")} aria-labelledby="rights-history">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="rights-history" className="font-semibold text-ink">
            Rights history
          </h2>
          <nav aria-label="Filter history" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
            {(
              [
                ["all", "All"],
                ["rights", "Ownership"],
                ["license", "Licenses"],
                ["publication", "Publication"],
                ["derivative", "Derivatives"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={historyFilter === k}
                onClick={() => setHistoryFilter(k)}
                className={cn("inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm", historyFilter === k ? "bg-accent font-medium text-white" : "text-ink-muted hover:bg-black/[0.04]")}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <p className="mt-1 text-xs text-ink-subtle">Every change is recorded here and can&apos;t be edited or removed.</p>
        {history.length ? (
          <ol className="mt-3 space-y-2 border-l border-border-soft pl-4" aria-label="Rights events, newest first">
            {history.map((e) => (
              <li key={e.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-accent" aria-hidden />
                <p className="text-ink">
                  {e.title}
                  {e.derivativeId ? (
                    <>
                      {" "}
                      <Link href={`/artifacts/${e.derivativeId}`} className="text-accent-ink hover:underline">
                        Open it
                      </Link>
                    </>
                  ) : null}
                </p>
                <p className="text-xs text-ink-subtle">
                  <RelativeTime iso={e.created_at} />
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">Nothing recorded here yet.</p>
        )}
      </section>
      {isOwner ? <OwnerLicenseRequests requests={licenseRequests} /> : title ? <RequesterLicensing artifactId={artifactId} title={title} requests={licenseRequests} /> : null}
      {isOwner && licenseOpen ? <CreateLicenseDialog open onOpenChange={setLicenseOpen} artifactId={artifactId} /> : null}
    </div>
  );
}

