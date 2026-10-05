"use client";
import { RelativeTime } from "@/components/client-time";
import { stepUpErrorMessage, useStepUp } from "@/components/step-up";
import { COMMERCIAL_USE, commercialReadiness, commercialUseLabel, READINESS_NOTE } from "@wonder/creator-studio/commercial";
import { EXPORT_FORMATS, exportFormatsFor } from "@wonder/creator-studio/exports";
import { channelLabels } from "@wonder/creator-studio/licensing";
import { ARTIFACT_TYPES, actionsFor } from "@wonder/creator-studio/types";
import type { OrnamentKey, WritingStyle } from "@wonder/creator-studio/pages";
import type { PartContext } from "@wonder/creator-projects/parts-options";
import { WrittenPiece } from "@/components/writing/written-piece";
import { PartChangesSheet, PartNotice, type PartOther } from "./studio/part-context";
import {
  Avatar,
  Badge,
  Button,
  CreativeMindInsight,
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
  chipBase,
} from "@wonder/ui";
import { Check, ChevronRight, CircleAlert, Compass, Download, Eye, GitBranch, History, Layers, MoreHorizontal, PenLine, Radio, RotateCcw, Send, Share2, Shield, Sparkles, Trash2, Users, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { type MaterialCardData } from "@/components/cards";
import { VisualDirections } from "@/components/visual-directions";
import { MaterialGrid, type GraphNode } from "./context-parts";
import { api, errorMessage } from "@/lib/client";
import { diffLines } from "@/lib/diff";
import { LicencePayment } from "@/components/payments/licence-payment";
import { ChannelChips, CreateLicenseDialog, OwnerLicenseRequests, RequesterLicensing, type LicenseRequestView } from "./licensing";

interface Version {
  id: string;
  version_number: number;
  label: string;
  content: string;
  change_summary: string | null;
  author_kind: string;
  created_at: string;
}
interface Rights {
  id: string;
  ownership_kind: string;
  copyright_holder: string;
  copyright_registration: string | null;
  attribution_required: boolean;
  derivatives_allowed: boolean;
  notes: string | null;
  commercial_use: string;
  commercial_channels: string[];
  rights_owners: Array<{ id: string; owner_name: string; share_percent: number; owner_creator_id: string | null }>;
  licenses: Array<{ id: string; license_type: string; licensee_name: string | null; status: string; territory: string; exclusive: boolean; starts_on: string | null; ends_on: string | null; usage_channels: string[]; fee_amount?: number | null; fee_currency?: string | null }>;
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
  /** DejaVu chips (docs/moments-dejavu.md §10). */
  dejavu?: React.ReactNode;
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
  /** Where it's worked on (its format's own page) and how its words are set (creation-pages.md). */
  workPath: string;
  workPage: "write" | "image" | "audio" | "studio";
  writingStyle: WritingStyle;
  ornament: OrnamentKey;
  /** A part of a Creative Room's joint work (creative-room-parts.md). */
  part: PartContext | null;
  licenseRequests: LicenseRequestView[];
  commercialStance: { commercialUse: string; commercialChannels: string[] } | null;
}) {
  const { artifact: a, isOwner } = props;
  const router = useRouter();
  const current = props.versions.find((v) => v.id === a.current_version_id) ?? props.versions[0];
  const [tab, setTab] = useState(["details", "material", "versions", "rights"].includes(props.initialTab ?? "") ? props.initialTab! : "details");
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
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

  const statusLabel = a.status === "draft" ? "In Progress" : a.status === "in_review" ? "In Review" : a.status === "final" ? "Completed" : a.status === "published" ? "Published" : a.status === "archived" ? "Archived" : a.status;
  const suggestion = props.quality?.suggestions.find((x) => x.title || x.detail);
  const isScript = /Film|Script|Screenplay|Trailer|Dialogue/.test(props.typeLabel);
  // Finished work leads with sharing; work in progress leads with continuing (interaction-minimalism §24).
  const finished = a.status === "final" || a.status === "published";

  // Where it's worked on decides how it leads (owner, 5 Oct 2026: "make the layout better according to context"): the
  // words set on paper for writing, the picture or the recording for the others; one action named for that format.
  const words = current?.content?.trim() ?? "";
  const continueLabel = props.workPage === "write" ? "Continue writing" : props.workPage === "audio" ? "Continue recording" : props.workPage === "image" ? "Edit the pictures" : "Continue Creating";
  const showPreview = props.workPage === "write" && !!words;
  const privacyLabel = a.privacy === "public" ? "Public" : a.privacy === "shared" ? "Shared" : "Private";
  const [partSheet, setPartSheet] = useState<PartOther | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {props.workPage === "write" ? (
        // Writing: the piece itself, set the way its kind is read (the Read page's renderer), on paper.
        <section aria-label="Preview" className="overflow-hidden rounded-3xl border border-border-soft bg-cream shadow-[var(--shadow-card)]">
          {props.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.coverUrl} alt="" className="h-36 w-full object-cover sm:h-48" />
          ) : null}
          <article aria-label="Current version" className="max-h-[34rem] overflow-auto px-6 pb-6 pt-7 sm:px-10">
            <WrittenPiece
              style={props.writingStyle}
              kicker={props.typeLabel}
              title={a.title || "Untitled"}
              text={words}
              byline={props.owner.name}
              date={a.updated_at}
              ornament={props.ornament}
              as="h1"
              empty={<span className="text-ink-muted">Nothing written yet.</span>}
            />
          </article>
          {words.split("\n").length > 18 ? (
            <Link href={`/creations/${a.id}/read`} className="flex min-h-11 items-center justify-center border-t border-border-soft text-[13px] font-medium text-accent-ink hover:bg-black/[0.02]">
              Read it all
            </Link>
          ) : null}
        </section>
      ) : (
        <section aria-label="Preview" className="overflow-hidden rounded-3xl border border-border-soft bg-surface shadow-[var(--shadow-card)]">
          {props.coverUrl ? (
            <div className="relative h-52 sm:h-auto sm:aspect-[16/9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={props.coverUrl} alt="" className="size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/75 via-navy/10 to-transparent" />
              <h1 className="absolute bottom-4 left-4 right-4 break-words font-display text-[22px] italic leading-tight text-white sm:left-6 sm:text-3xl">{a.title}</h1>
            </div>
          ) : (
            <h1 className="break-words px-4 pt-4 font-display text-[22px] leading-tight text-ink sm:px-6 sm:pt-5 sm:text-3xl">{a.title}</h1>
          )}
          {words || props.workPage !== "image" ? (
            <article
              aria-label="Current version"
              className={cn("m-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-muted p-4 leading-relaxed text-ink sm:m-5", isScript ? "font-mono text-[13px]" : "font-display text-base")}
            >
              {words || "This Creation is empty. Open it to begin."}
            </article>
          ) : (
            <div className="h-3" />
          )}
        </section>
      )}

      {/* One line: what it is and where it stands (density §38). */}
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[13px] text-ink-muted">
          {props.workPage === "write" ? "" : `${props.typeLabel} · `}
          {current ? `v${current.version_number} · ` : ""}
          <span className={cn(finished && "text-success-ink")}>{statusLabel}</span> · {privacyLabel}
        </p>
        <Menu>
          <MenuTrigger className={buttonClasses({ variant: "ghost", size: "sm", className: "-my-2 px-2.5" })} aria-label="More actions">
            <MoreHorizontal className="size-5" aria-hidden />
          </MenuTrigger>
          <MenuContent align="end">
            {isOwner && !finished && showPreview ? (
              <MenuItem onSelect={() => router.push(`/creations/${a.id}/transform`)}>
                <Wand2 className="size-4" aria-hidden /> Transform
              </MenuItem>
            ) : null}
            <MenuItem onSelect={() => router.push(`/creations/${a.id}/context`)}>
              <Compass className="size-4" aria-hidden /> Context
            </MenuItem>
            <MenuItem onSelect={() => setDownloadOpen(true)}>
              <Download className="size-4" aria-hidden /> Download…
            </MenuItem>
            {isOwner && !finished ? (
              <MenuItem onSelect={() => router.push(`/creations/${a.id}/publish`)}>
                <Send className="size-4" aria-hidden /> Publish
              </MenuItem>
            ) : null}
            {isOwner && props.canCollaborate ? (
              <MenuItem onSelect={() => router.push(`/creations/${a.id}/collaborate`)}>
                <Users className="size-4" aria-hidden /> Collaborate
              </MenuItem>
            ) : null}
            {isOwner ? (
              <>
                <MenuItem onSelect={() => router.push(`/creations/${a.id}/derivatives`)}>
                  <Layers className="size-4" aria-hidden /> For a destination
                </MenuItem>
                <MenuItem onSelect={() => router.push(`/create?artifact=${a.id}`)}>
                  <Sparkles className="size-4" aria-hidden /> meTalk about this
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
              </>
            ) : null}
          </MenuContent>
        </Menu>
      </div>

      {/* A part of a Room's joint work: which Room, and what the other parts are doing (creative-room-parts.md, step 2). */}
      {props.part ? <PartNotice part={props.part} onChanges={(o) => setPartSheet(o)} /> : null}

      {/* One primary action for where this Creation is, at most two secondary ones; the rest under More and in the
          Palette (interaction-minimalism §11, §24; Fewer buttons). */}
      <div className="flex flex-wrap items-center gap-1.5">
        {isOwner && !finished ? (
          <>
            <Link href={props.workPath} className={buttonClasses({ size: "sm" })}>
              <PenLine className="size-4" aria-hidden /> {continueLabel}
            </Link>
            {showPreview ? (
              <Link href={`/creations/${a.id}/preview`} className={buttonClasses({ variant: "secondary", size: "sm", className: "px-3" })}>
                <Eye className="hidden size-4 sm:block" aria-hidden /> Preview
              </Link>
            ) : (
              <Link href={`/creations/${a.id}/transform`} className={buttonClasses({ variant: "secondary", size: "sm", className: "px-3" })}>
                <Wand2 className="hidden size-4 sm:block" aria-hidden /> Transform
              </Link>
            )}
            <Button variant="secondary" size="sm" className="px-3" onClick={() => setShareOpen(true)}>
              <Share2 className="hidden size-4 sm:block" aria-hidden /> Share
            </Button>
          </>
        ) : isOwner ? (
          <>
            <Button size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="size-4" aria-hidden /> Share
            </Button>
            <Link href={`/creations/${a.id}/publish`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <Send className="size-4" aria-hidden /> Publish
            </Link>
            <Link href={`/creations/${a.id}/transform`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <Wand2 className="size-4" aria-hidden /> Create from this
            </Link>
          </>
        ) : props.canCollaborate ? (
          <Link href={`/creations/${a.id}/collaborate`} className={buttonClasses({ size: "sm" })}>
            <Users className="size-4" aria-hidden /> Collaborate
          </Link>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
        <DialogContent title="Download" description="The current version, in the format you need.">
          <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
            {exportFormatsFor(a.artifact_type).map((f) => (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => {
                    downloadFile(`/api/v1/artifacts/${a.id}/export?format=${f}`);
                    setDownloadOpen(false);
                  }}
                  className="flex min-h-12 w-full items-center px-3 text-left text-sm text-ink hover:bg-black/[0.02]"
                >
                  {EXPORT_FORMATS[f].label} (.{EXPORT_FORMATS[f].ext})
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      {props.part && partSheet ? <PartChangesSheet key={partSheet.partId} open projectId={props.part.project.id} other={partSheet} onOpenChange={(o) => !o && setPartSheet(null)} /> : null}

      {/* Details, below the work: who and where from, versions, rights. */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabList label="Creation sections">
          <Tab value="details">About</Tab>
          {createdFrom.length ? <Tab value="material">Materials ({createdFrom.length})</Tab> : null}
          <Tab value="versions">Versions ({props.versions.length})</Tab>
          <Tab value="rights">Rights</Tab>
        </TabList>

        <TabPanel value="details">
          <div className="space-y-3">
            <section aria-labelledby="about-people" className="space-y-2 rounded-2xl border border-border-soft bg-surface p-4">
              <h2 id="about-people" className="sr-only">
                People
              </h2>
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={props.owner.name} src={props.owner.avatarUrl} size={20} />
                  <span className="max-w-[10rem] truncate text-ink">{props.owner.name}</span>
                </span>
                <span aria-hidden>·</span>
                <span>
                  Started {new Date(a.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} from{" "}
                  {derivedFrom.length ? (
                    <Link href={`/creations/${derivedFrom[0].id}`} className="text-accent-ink hover:underline">
                      “{derivedFrom[0].title}”
                    </Link>
                  ) : createdFrom.length ? (
                    `${createdFrom.length} material${createdFrom.length === 1 ? "" : "s"}`
                  ) : (
                    "a blank page"
                  )}
                </span>
                {props.rights ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{props.rights.ownership_kind === "joint" ? "Joint ownership" : "All rights reserved"}</span>
                  </>
                ) : null}
              </p>
              {props.contributors.length ? (
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink" aria-label="Collaborators">
                  {props.contributors.map((c) => (
                    <li key={`${c.name}${c.role}`}>
                      {c.name} <span className="text-ink-subtle">· {c.role}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {a.description ? <p className="text-[14px] text-ink-muted">{a.description}</p> : null}
              {props.dejavu}
              {derivatives.length ? (
                <p className="text-[13px] text-ink-muted">
                  Made from this:{" "}
                  {derivatives.map((d, i) => (
                    <span key={d.key}>
                      {i ? ", " : ""}
                      <Link className="font-medium text-accent-ink hover:underline" href={`/creations/${d.id}`}>
                        {d.title}
                      </Link>
                    </span>
                  ))}
                </p>
              ) : null}
            </section>
            {props.quality ? (
              <section aria-labelledby="about-quality" className="rounded-2xl border border-border-soft bg-surface p-4">
                <h2 id="about-quality" className="text-[15px] font-semibold text-ink">
                  Quality
                </h2>
                <ul className="mt-2 space-y-2 text-sm">
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
                    <h3 className="mt-3 text-sm font-medium text-ink">Suggestions to consider</h3>
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
              </section>
            ) : null}
            {/* Visual directions from this Creation (image-generation §31): stored ones show at once; new ones only when asked. */}
            {isOwner && a.status !== "archived" && a.artifact_type !== "carousel" ? <VisualDirections creationId={a.id} purpose="explore" title="Visual directions" className="rounded-2xl border border-border-soft bg-surface p-4" /> : null}
          </div>
        </TabPanel>

        <TabPanel value="material">
          <MaterialGrid items={createdFrom} empty="This Creation wasn't made from saved Materials." />
          <p className="mt-3 text-sm text-ink-muted">
            References, people and related Creations are in the{" "}
            <Link href={`/creations/${a.id}/context`} className="font-medium text-accent-ink hover:underline">
              Context view
            </Link>
            .
          </p>
        </TabPanel>

        <TabPanel value="versions">
          <Versions artifactId={a.id} versions={props.versions} currentId={a.current_version_id} isOwner={isOwner} />
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
            outsideMaterials={props.materials.filter((m) => !!m.source_url).length}
            stance={props.commercialStance}
            title={a.privacy === "public" && (a.status === "final" || a.status === "published") ? a.title : null}
          />
        </TabPanel>
      </Tabs>

      {/* 7. One CreativeMind insight, only when CreativeMind actually said something. */}
      {suggestion ? (
        <CreativeMindInsight
          kind="insight"
          action={
            isOwner ? (
              <Link href={`/creations/${a.id}/studio`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">
                Refine in the Creative Studio
              </Link>
            ) : undefined
          }
        >
          {suggestion.title ? <span className="font-medium">{suggestion.title}. </span> : null}
          {suggestion.detail}
        </CreativeMindInsight>
      ) : null}

      {isOwner ? (
        <>
          <ShareDialog key={shareOpen ? "open" : "closed"} open={shareOpen} onOpenChange={setShareOpen} artifact={a} onSave={patch} />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            destructive
            busy={busy}
            title="Delete this Creation permanently?"
            body="All versions, lineage and rights records for this Creation will be removed. Your source material stays safe. This can't be undone."
            confirmLabel="Delete permanently"
            onConfirm={async () => {
              setBusy(true);
              try {
                await api(`/api/v1/artifacts/${a.id}?confirm=true`, { method: "DELETE" });
                router.replace("/materials");
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
              <Badge>{v.author_kind === "ai" ? "CreativeMind" : v.author_kind === "restore" ? "Restored" : "You"}</Badge>
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
        {left && right && left !== right ? (
          <Link href={`/creations/${artifactId}/compare?a=${left}&b=${right}`} className="mb-2 inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">
            Open the compare view — before / after, or swipe
          </Link>
        ) : null}
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
      <DialogContent title="Share" description="Choose who can see this Creation. Private by default.">
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium text-ink">Mark as final</span>
              <span className="text-sm text-ink-muted">Only final Creations can be shown publicly.</span>
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
          <Link href={`/creations/${artifact.id}/share`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border-soft px-4 py-2 hover:bg-black/[0.02]">
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
  focused = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  artifactId: string;
  currentType: string;
  initialType?: string;
  source?: TransformSource;
  /** Focused configuration (UI redesign §17): the format was already chosen on the Transform screen. */
  focused?: boolean;
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
      <DialogContent title="Create a derivative" description="A new Creation adapted from this one. The original stays unchanged and the new Creation records where it came from." wide>
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

        {focused && type ? (
          <p className="mt-4 rounded-2xl border border-accent/30 bg-accent-softer px-4 py-3 text-sm text-ink">
            Turning it into <span className="font-medium">{ARTIFACT_TYPES.find((t) => t.type === type)?.label ?? type}</span> — {artifactTypeLabel(type)}
          </p>
        ) : null}
        <fieldset className={cn("mt-4", focused && "hidden")}>
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
            <summary className="cursor-pointer text-sm text-accent-ink">More kinds of Creation</summary>
            <Field label="Any kind of Creation" htmlFor="target" className="mt-2">
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
              <li>A link back to this Creation and the version you chose.</li>
              <li>{source.materials ? `${source.materials} piece${source.materials === 1 ? "" : "s"} of material it was made from.` : "No material was attached to this Creation."}</li>
              {source.contributors.length ? <li>Contributors: {source.contributors.join(", ")}.</li> : null}
              {source.rights ? (
                <li>
                  Rights: {source.rights.ownershipKind === "joint" ? `jointly owned (${source.rights.owners.join(", ")})` : "your ownership"}
                  {source.rights.attributionRequired ? ", attribution required" : ""}.
                </li>
              ) : null}
              <li>The new Creation starts as a private draft — you review it before sharing or publishing.</li>
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
                router.push(`/creations/${r.artifact.id}`);
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
  outsideMaterials,
  stance,
}: {
  artifactId: string;
  outsideMaterials: number;
  stance: { commercialUse: string; commercialChannels: string[] } | null;
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
    commercialUse: rights?.commercial_use ?? "on_request",
    commercialChannels: rights?.commercial_channels ?? [],
    owners: (rights?.rights_owners ?? []).map((o) => ({ name: o.owner_name, sharePercent: Number(o.share_percent), creatorId: o.owner_creator_id })),
  }));
  if (!rights)
    return (
      <div className="space-y-3">
        <p className="text-ink-muted">Rights details are only visible to the creator.</p>
        {title ? <RequesterLicensing artifactId={artifactId} title={title} requests={licenseRequests} stance={stance} /> : null}
      </div>
    );
  const history = historyFilter === "all" ? rights.events : rights.events.filter((e) => e.kind === historyFilter);
  const total = form.owners.reduce((s, o) => s + (Number(o.sharePercent) || 0), 0);

  return (
    <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[1.2fr_1fr]">
      {stepUp.dialog}
      {/* At a glance (UI redesign §20): reassuring, plain, and only what the stored record says. */}
      <section aria-labelledby="rights-glance" className="rounded-2xl border border-border-soft bg-surface p-5 lg:col-span-full">
        <h2 id="rights-glance" className="font-display text-2xl text-ink">
          {rights.ownership_kind === "transferred"
            ? "Ownership of this Creation was transferred"
            : isOwner
              ? rights.ownership_kind === "joint"
                ? "You share ownership of this Creation"
                : "You own this Creation"
              : `${rights.rights_owners.map((o) => o.owner_name).join(" & ") || "Its creator"} ${rights.rights_owners.length > 1 ? "own" : "owns"} this Creation`}
        </h2>
        <ul className="mt-3 divide-y divide-border-soft text-[15px]" aria-label="What this record allows">
          <li className="flex min-h-12 items-center justify-between gap-3">
            <span className="text-ink">Personal use</span>
            <span className="text-ink-muted">{isOwner ? "Included" : "Ask the owner"}</span>
          </li>
          <li className="flex min-h-12 items-center justify-between gap-3">
            <span className="text-ink">
              Sharing as the creator
              <span className="block text-xs text-ink-subtle">Posting and showing your own work</span>
            </span>
            <span className="text-ink-muted">{isOwner ? "Included" : "—"}</span>
          </li>
          <li className="flex min-h-12 items-center justify-between gap-3">
            <span className="text-ink">
              Commercial use
              <span className="block text-xs text-ink-subtle">
                {commercialUseLabel(rights.commercial_use)}
                {rights.commercial_channels.length ? ` · ${channelLabels(rights.commercial_channels).join(", ")}` : ""}
              </span>
            </span>
            {rights.licenses.some((l) => l.license_type === "commercial" && l.status === "active") ? (
              <span className="text-ink-muted">
                Licensed ({rights.licenses.filter((l) => l.license_type === "commercial" && l.status === "active").length})
              </span>
            ) : isOwner ? (
              <Button size="sm" variant="secondary" onClick={() => setLicenseOpen(true)}>
                Add a commercial license
              </Button>
            ) : (
              <span className="text-ink-muted">Not licensed</span>
            )}
          </li>
          <li className="flex min-h-12 items-center justify-between gap-3">
            <span className="text-ink">Credit</span>
            <span className="text-ink-muted">{rights.attribution_required ? "Attribution required" : "Not required"}</span>
          </li>
        </ul>
      </section>
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
            <Field label="Commercial use" htmlFor="commercial-use" hint={COMMERCIAL_USE.find((c) => c.value === form.commercialUse)?.note}>
              <Select id="commercial-use" value={form.commercialUse} onChange={(e) => setForm({ ...form, commercialUse: e.target.value })}>
                {COMMERCIAL_USE.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            {form.commercialUse !== "not_offered" ? (
              <ChannelChips label="Channels you're open to (optional)" value={form.commercialChannels} onChange={(commercialChannels) => setForm({ ...form, commercialChannels })} />
            ) : null}
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
                    <Link href={`/creations/${provenance.derivedFrom.id}`} className="text-accent-ink hover:underline">
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

      {isOwner ? (
        <details className="group rounded-2xl border border-border-soft bg-surface px-5 py-1 lg:col-span-full">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-semibold text-ink [&::-webkit-details-marker]:hidden">
            Before licensing commercially
            <ChevronRight className="size-4 text-ink-subtle transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
          </summary>
          <ul className="divide-y divide-border-soft pb-2" aria-label="Commercial readiness">
            {commercialReadiness({
              ownershipKind: rights.ownership_kind,
              owners: rights.rights_owners.map((o) => ({ name: o.owner_name, sharePercent: Number(o.share_percent) })),
              copyrightHolder: rights.copyright_holder,
              commercialUse: rights.commercial_use,
              commercialChannels: rights.commercial_channels,
              contributors: contributors.length,
              outsideMaterials,
              derivedFrom: provenance.derivedFrom?.title ?? null,
              licenses: rights.licenses,
            }).map((item) => (
              <li key={item.key} className="flex gap-2.5 py-2">
                {item.state === "recorded" ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden />}
                <span className="min-w-0 text-sm">
                  <span className="text-ink">
                    <span className="sr-only">{item.state === "recorded" ? "Recorded: " : "Worth checking: "}</span>
                    {item.label}
                  </span>
                  <span className="block text-[13px] text-ink-muted">{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="pb-3 text-xs text-ink-subtle">{READINESS_NOTE}</p>
        </details>
      ) : null}

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
                <span className="min-w-0">
                  <span className="font-medium text-ink">{LICENSE_LABEL[l.license_type]}</span>
                  <span className="block text-xs text-ink-subtle">
                    {l.licensee_name || "Any licensee"} · {l.territory}
                    {l.exclusive ? " · Exclusive" : ""}
                    {l.usage_channels?.length ? ` · ${channelLabels(l.usage_channels).join(", ")}` : ""}
                    {l.ends_on ? ` · until ${l.ends_on}` : ""}
                  </span>
                  {isOwner && l.status === "active" && Number(l.fee_amount) > 0 && l.fee_currency ? (
                    <LicencePayment licenseId={l.id} role="owner" fee={{ amount: Number(l.fee_amount), currency: l.fee_currency }} />
                  ) : null}
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
                className={cn(chipBase, historyFilter === k ? "bg-accent font-medium text-white" : "text-ink-muted hover:bg-black/[0.04]")}
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
                      <Link href={`/creations/${e.derivativeId}`} className="text-accent-ink hover:underline">
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
      {isOwner ? <OwnerLicenseRequests requests={licenseRequests} /> : title ? <RequesterLicensing artifactId={artifactId} title={title} requests={licenseRequests} stance={stance} /> : null}
      {isOwner && licenseOpen ? <CreateLicenseDialog open onOpenChange={setLicenseOpen} artifactId={artifactId} /> : null}
    </div>
  );
}

