"use client";
import type { CarouselView } from "@wonder/creator-brain";
import { OUTPUT_MODES, outputModeOf, unusedNudge, workingSetSummary, type MaterialAction, type WorkingSetView, type WorkingSource } from "@wonder/creator-studio/working-set";
import type { StudioAction } from "@wonder/creator-studio/types";
import { creationPath, writingStyleOf, type CreationLook, type OrnamentKey } from "@wonder/creator-studio/pages";
import { Avatar, BACKGROUNDS, Button, Dialog, DialogContent, ErrorState, Input, KIT, KitArt, Segmented, Switch, buttonClasses, cn } from "@wonder/ui";
import { Check, Copy, Eye, ChevronDown, ChevronUp, ImageIcon, Maximize2, MoreHorizontal, PenLine, Sparkles, Wand2, X, Download, Headphones, ImagePlus, Mic, SlidersHorizontal, Type, Plus, Presentation, Clapperboard, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStripSignal } from "@/components/creative-palette";
import { useMiniPlayerConstraint } from "@/components/soundtrack/audio-provider";
import { api, errorMessage } from "@/lib/client";
import { diffLines } from "@/lib/diff";
import { useFeature } from "@/components/features";
import { BackLink } from "@/components/back-link";
import { CarouselCanvas, type CanvasNews, type SlidesState } from "./carousel-canvas";
import { AskCommunitySheet, CommunityResponsesSheet, DejaVuIntakeSheet, useCommunityResponses, type AskFragment } from "./studio-community";
import { QualityPanel, type QualityProposal, type QualityReportView } from "./quality-panel";
import { BringInSheet, ChangeFormatSheet, FragmentsSheet, SourceIcon, WorkingSetSheet } from "./working-set";
import { WorkingTable, type ExternalAdded } from "./working-table";
import { WrittenPiece } from "@/components/writing/written-piece";
import type { ImageSet } from "@wonder/creator-studio/images";
import { ImagesCanvas, type ImagesRequest, type Picture } from "./images-canvas";
import { DeckCanvas, type DeckControls } from "./deck-canvas";
import type { Deck } from "@wonder/creator-studio/deck";
import type { Storyboard } from "@wonder/creator-studio/storyboard";
import { VideoCanvas, type VideoControls } from "./video-canvas";
import { AloudSheet, CraftSheet } from "./writing-tools";
import { AudioPanel, type AudioRequest, type AudioTakeView } from "./audio-canvas";
import { CoverSheet, ExportSheet, KindSheet, PublishLinkSheet } from "./writing-sheets";
import type { PartContext, PlayAlong } from "@wonder/creator-projects/parts-options";
import { PlayAlongBar } from "./play-along";
import { PartChangesSheet, PartNotice, SuggestSheet, type PartOther } from "./part-context";

/**
 * The Creative Studio canvas (creative-studio-working-set.md §5–7, §44–47, §64–68): the Creation is the screen. One
 * compact "Sources N · M in use" pill (Bring in is inside it) sits at the bottom; the top bar names the Creation, says
 * "Autosaved", and shows who's on it. Writing autosaves as a draft; a version is made only at a checkpoint the creator
 * chooses ("Save as new version"). CreativeMind shows at most one quiet bubble at a time.
 */
export function Studio({
  page = "studio",
  images,
  deck = null,
  video = null,
  audio,
  published = null,
  artifact,
  version,
  actions,
  initialAction,
  addOnOpen,
  madeFrom,
  people,
  carousel,
  quality,
  pendingProposal,
  offline,
  part = null,
  playAlong = null,
}: {
  /** The Writing page (creation-pages.md) or the general Studio. Same header, Working Table and Save as version. */
  page?: "writing" | "images" | "audio" | "presentation" | "video" | "studio";
  /** The Video page's storyboard and its frames' addresses (creation-pages.md, step 5). */
  video?: { storyboard: Storyboard; frames: Record<string, string | null> } | null;
  /** The Presentation page's slides and their pictures' addresses (creation-pages.md, step 4). */
  deck?: { deck: Deck; pictures: Record<string, string | null> } | null;
  /** Published and reachable: the live link, and whether newer saved words exist here. */
  published?: { url: string; newer: boolean } | null;
  /** The Images page's pictures and what was done to them (creation-pages.md, step 2). */
  images?: { set: ImageSet; pictures: Record<string, Picture> } | null;
  /** The Audio page's kept take (creation-pages.md, step 3). */
  audio?: { take: AudioTakeView | null } | null;
  artifact: { id: string; title: string; type: string; typeLabel: string; format: string; status: string; coverUrl: string | null; look: CreationLook; updatedAt?: string; ornament?: OrnamentKey };
  version: { id: string; number: number; content: string } | null;
  actions: StudioAction[];
  initialAction: string | null;
  /** `type:id` sent from a Huddle or a comment ("Use in Studio", §34–35). */
  addOnOpen: string | null;
  /** The Creation this one was just made from (Change format); it's unchanged. */
  madeFrom?: { id: string; title: string } | null;
  people: Array<{ id: string; name: string; avatarUrl: string | null }>;
  carousel: CarouselView | null;
  quality: QualityReportView | null;
  pendingProposal: QualityProposal | null;
  offline: boolean;
  /** A part of a Creative Room's joint work (creative-room-parts.md, step 2): what it was made with, what moved on. */
  part?: PartContext | null;
  /** Step 3: the other parts' takes to play here, and (on the Audio page) a writing part's words to read. */
  playAlong?: PlayAlong | null;
}) {
  // Immersive: the mini player stays a slim tab (music keeps playing; mini-player.md §33).
  useMiniPlayerConstraint({ forceCollapsed: true });
  const router = useRouter();
  const strip = useStripSignal();

  /* ------------------------------------------------------------ Working Set */
  const [set, setSet] = useState<WorkingSetView | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const typed = useRef(false);
  const [content, setContent] = useState(version?.content ?? "");
  const [base, setBase] = useState(version);
  const [title, setTitle] = useState(artifact.title);
  // The Audio page has no reading view: the recording sits above the words, which are always editable.
  const [mode, setMode] = useState<"view" | "edit">(version?.content && page !== "audio" ? "view" : "edit");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A transform chip on the way in (?action=) opens Change format straight away.
  const [sheet, setSheet] = useState<null | "table" | "table-available" | "table-external" | "set" | "influence" | "bring" | "format" | "save" | "more" | "dejavu" | "responses" | "ask" | "refine" | "cover" | "publish" | "export" | "kind" | "craft" | "aloud">(() => (actions.find((x) => x.key === initialAction)?.kind === "transform" ? "format" : null));
  const [fragmentsFor, setFragmentsFor] = useState<WorkingSource | null>(null);
  // A part's page (step 2): what changed in another part, or new words suggested to it.
  const [partSheet, setPartSheet] = useState<{ kind: "changes" | "suggest"; other: PartOther } | null>(null);
  const suggestable = part?.others.filter((o) => o.canSuggest) ?? [];
  const suggestRows = suggestable.map((o) => ({ label: `Suggest to ${o.title}`, hint: `New words for ${o.title} — the people on it decide`, act: () => setPartSheet({ kind: "suggest", other: o }) }));
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        let r = await api<{ workingSet: WorkingSetView }>("/api/v1/studio-sessions", { method: "POST", json: { artifactId: artifact.id } });
        if (addOnOpen) {
          const [type, id] = addOnOpen.split(":");
          // Community things arrive Available (Phase 04 §7): someone else's words wait until the creator chooses a use.
          const community = type === "conversation" || type === "conversation_reply" || type === "scrapbook_entry";
          r = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${r.workingSet.sessionId}/sources`, { method: "POST", json: { items: [{ type, id }], state: community ? "available" : "in_use" } });
          router.replace(creationPath(artifact.id, artifact.type));
        }
        if (!live) return;
        setSet(r.workingSet);
        // Resume (§45): the autosaved draft for this version comes back with the session — unless typing already began.
        const d = r.workingSet.draft;
        if (d && !typed.current && d.baseVersionId === (version?.id ?? null) && d.text !== (version?.content ?? "")) {
          setContent(d.text);
          setSavedAt(d.savedAt);
        }
      } catch (e) {
        if (live) setWsError(errorMessage(e));
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact.id]);
  const sources = set?.sources ?? [];
  const inUse = sources.filter((s) => s.state !== "available").length;
  // Replies to what the creator asked Community about this Creation (Phase 04 §14).
  const [respKey, setRespKey] = useState(0);
  const communityOn = useFeature("community_to_studio_enabled");
  const askOn = useFeature("ask_community_enabled");
  const [responses] = useCommunityResponses(communityOn ? (set?.sessionId ?? null) : null, respKey);
  const change = useCallback(
    async (row: WorkingSource, body: { state?: WorkingSource["state"] } | "remove") => {
      if (!set) return;
      setSet((s) => (s ? { ...s, sources: body === "remove" ? s.sources.filter((x) => x.id !== row.id) : s.sources.map((x) => (x.id === row.id ? { ...x, ...body } : x)) } : s));
      try {
        const r = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${set.sessionId}/sources/${row.id}`, body === "remove" ? { method: "DELETE" } : { method: "PATCH", json: body });
        setSet(r.workingSet);
      } catch (e) {
        setWsError(errorMessage(e));
      }
    },
    [set],
  );
  // The slide on screen (Carousel), reported by the canvas.
  const [slides, setSlides] = useState<SlidesState>({ current: null, ids: [], index: 0, text: "" });
  // Which slides each source is used in (derived on the server from what's recorded), for "Slide 2 · 3 sources".
  const [usage, setUsage] = useState<Record<string, number[]>>({});
  const usageKey = set ? `${set.sessionId}:${sources.map((s) => `${s.id}${s.state}`).join(",")}` : null;
  useEffect(() => {
    if (!usageKey || artifact.type !== "carousel") return;
    let live = true;
    const t = setTimeout(() => {
      api<{ usage: Record<string, number[]> }>(`/api/v1/studio-sessions/${usageKey.split(":")[0]}/usage`)
        .then((r) => live && setUsage(r.usage))
        .catch(() => undefined);
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [usageKey, artifact.type]);
  // The navbar's quiet line (§45, §65): "3 sources · 2 unused" — on a Carousel, what's shaping the slide on screen
  // (Phase 04 §17): "Slide 2 · 3 sources" (the ones used in it, plus pinned ones, which hold everywhere).
  const slideNo = slides.current ? slides.index + 1 : null;
  const onSlide = slideNo ? sources.filter((s) => s.available && (s.state === "pinned" || usage[s.id]?.includes(slideNo))).length : 0;
  useEffect(() => {
    if (!set) return;
    const unused = sources.filter((s) => s.state === "available").length;
    if (artifact.type === "carousel" && slideNo)
      strip("sources", { text: `Slide ${slideNo} · ${onSlide} ${onSlide === 1 ? "source" : "sources"}`, shortText: `Slide ${slideNo}`, tone: "neutral", priority: 9 });
    else strip("sources", sources.length ? { text: `${workingSetSummary(sources)}${unused ? ` · ${unused} unused` : ""}`, shortText: `${sources.length} sources`, tone: "neutral", priority: 9 } : null);
    return () => strip("sources", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, slideNo, onSlide]);

  /* ------------------------------------------------------------ Canvas + autosave */
  const dirty = content !== (base?.content ?? "");
  // The last version saved from here, for the navbar's brief "Saved · vN".
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleVersion = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkpointRef = useRef<() => Promise<unknown>>(async () => undefined);
  const onType = (v: string) => {
    typed.current = true;
    setContent(v);
    if (!set) return;
    if (autosave.current) clearTimeout(autosave.current);
    // A part's words reach its crew without a Save: after a pause, a version is made too (see "Shared words" below).
    if (sharedWords) {
      if (idleVersion.current) clearTimeout(idleVersion.current);
      idleVersion.current = setTimeout(() => void checkpointRef.current(), IDLE_VERSION_MS);
    }
    setSaving(true);
    autosave.current = setTimeout(async () => {
      try {
        await api(`/api/v1/studio-sessions/${set.sessionId}`, { method: "PATCH", json: { draft: v === (base?.content ?? "") ? null : { text: v, baseVersionId: base?.id ?? null } } });
        setSavedAt(new Date().toISOString());
      } catch {
        // Kept in the editor; the next keystroke tries again.
      } finally {
        setSaving(false);
      }
    }, 900);
  };
  useEffect(() => {
    if (saving) strip("save", { text: "Saving…", tone: "active" });
    else if (savedAt) strip("save", { text: "Autosaved", tone: "success", ttl: 1500 });
    else if (savedVersion) strip("save", { text: `Saved · v${savedVersion}`, tone: "success", ttl: 1500 });
    else strip("save", null);
    return () => strip("save", null);
  }, [saving, savedAt, savedVersion, strip]);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  // A selection in the text offers Rewrite · Expand · Shorten (board §8) — CreativeMind on just that passage.
  const [selection, setSelection] = useState<string>("");
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<QualityProposal | null>(pendingProposal);
  // Refine lives in a sheet: the Palette's Refine (and old links) arrive as #creativemind; a revision on the canvas closes it.
  const writingCanvas = artifact.type !== "carousel" && page !== "images" && page !== "presentation" && page !== "video";
  useEffect(() => {
    if (!writingCanvas && !part) return;
    // The Writing page's own tools arrive the same way from the Palette: #craft (that kind's counts) and #aloud. The hash
    // is cleared once read, so the same leaf opens it again next time. #suggest (a part's page, step 2) works on every page.
    const open = () => {
      const h = window.location.hash;
      const first = part?.others.find((o) => o.canSuggest);
      if (h === "#suggest" && first) {
        setPartSheet({ kind: "suggest", other: first });
        history.replaceState(history.state, "", window.location.pathname + window.location.search);
        return;
      }
      if (!writingCanvas) return;
      const to = h === "#creativemind" ? "refine" : h === "#craft" && page === "writing" ? "craft" : h === "#aloud" && page === "writing" ? "aloud" : null;
      if (!to) return;
      setSheet(to);
      if (to !== "refine") history.replaceState(history.state, "", window.location.pathname + window.location.search);
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [writingCanvas, page, part]);
  if (proposal && sheet === "refine") setSheet(null);
  const [view, setView] = useState<"changes" | "original" | "proposed">("changes");
  const [q, setQ] = useState(quality);
  const [lastQuality, setLastQuality] = useState(quality);
  if (quality !== lastQuality) {
    setLastQuality(quality);
    setQ(quality);
  }
  const [kept, setKept] = useState<{ versionNumber: number; titles: string[] } | null>(null);
  async function saveTitle() {
    if (title.trim() && title.trim() !== artifact.title) {
      try {
        await api(`/api/v1/artifacts/${artifact.id}`, { method: "PATCH", json: { title: title.trim() } });
        router.refresh();
      } catch (e) {
        setError(errorMessage(e));
      }
    }
  }

  /** Save as new version (board §12): the checkpoint that makes a durable version from the draft. */
  async function saveVersion(opts: { name: string; keepUnused: boolean; quiet?: boolean }): Promise<boolean> {
    if (idleVersion.current) {
      clearTimeout(idleVersion.current);
      idleVersion.current = null;
    }
    // The version supersedes any pending draft autosave, which would otherwise land afterwards and re-store the draft.
    if (autosave.current) {
      clearTimeout(autosave.current);
      autosave.current = null;
      setSaving(false);
    }
    setWorking("version");
    setError(null);
    try {
      const r = await api<{ version: { id: string; version_number: number; content: string } }>(`/api/v1/artifacts/${artifact.id}/versions`, {
        method: "POST",
        json: {
          content,
          baseVersionId: base?.id,
          label: opts.name.trim().slice(0, 80) || "Revised",
          changeSummary: opts.quiet ? "Saved automatically." : `Saved in the Creative Studio${inUse ? ` with ${inUse} ${inUse === 1 ? "source" : "sources"} in use` : ""}.`,
        },
      });
      setBase({ id: r.version.id, number: r.version.version_number, content: r.version.content });
      if (set) {
        // What this version was made from: the sources in use or pinned (Phase 05, Scenario C).
        await api(`/api/v1/studio-sessions/${set.sessionId}/commit`, { method: "POST", json: { versionId: r.version.id } }).catch(() => undefined);
        await api(`/api/v1/studio-sessions/${set.sessionId}`, { method: "PATCH", json: { draft: null } });
        if (!opts.keepUnused) {
          const unused = sources.filter((s) => s.state === "available");
          for (const s of unused) await api(`/api/v1/studio-sessions/${set.sessionId}/sources/${s.id}`, { method: "DELETE" }).catch(() => undefined);
          const fresh = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${set.sessionId}`);
          setSet(fresh.workingSet);
        }
      }
      // A version, not a draft: the label reads "Saved" and the navbar briefly says which version.
      setSavedAt(null);
      setSavedVersion(r.version.version_number);
      if (!opts.quiet) setSheet(null);
      router.refresh();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setWorking(null);
    }
  }

  /* ------------------------------------------------------------ Shared words */
  // A Room's part is made by several people, and the others read its latest *version* — a private draft is invisible to
  // them (owner, 6 Oct 2026: "the crew sees an old version"). So on a part's Writing page the words are saved as a version
  // after a pause, when the tab is put away, and on leaving; everyone else then sees them.
  const sharedWords = !!part && writingCanvas;
  const latest = useRef({ content, base, dirty, sharedWords, working, id: artifact.id, session: set?.sessionId ?? null });
  useEffect(() => {
    latest.current = { content, base, dirty, sharedWords, working, id: artifact.id, session: set?.sessionId ?? null };
  });
  useEffect(() => {
    checkpointRef.current = async () => {
      const l = latest.current;
      if (!l.sharedWords || !l.dirty || l.working || !l.content.trim()) return;
      await saveVersion({ name: "Autosaved", keepUnused: true, quiet: true });
    };
  });
  useEffect(() => {
    if (!sharedWords) return;
    // Putting the tab away, closing it and leaving the page all save the words as a version, with a request that outlives
    // the page (keepalive); the page itself is gone on a real navigation, so nothing here waits on React.
    let sending: string | null = null;
    const persist = async () => {
      const l = latest.current;
      if (!l.dirty || l.working || !l.content.trim() || !l.base || sending === l.content) return;
      sending = l.content;
      try {
        const res = await fetch(`/api/v1/artifacts/${l.id}/versions`, {
          method: "POST",
          keepalive: true,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: l.content, baseVersionId: l.base.id, label: "Autosaved", changeSummary: "Saved automatically." }),
        });
        if (!res.ok) return;
        const { version: v } = (await res.json()) as { version: { id: string; version_number: number; content: string } };
        if (l.session) void fetch(`/api/v1/studio-sessions/${l.session}`, { method: "PATCH", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ draft: null }) }).catch(() => undefined);
        // Still here (the tab was only put away): the page now stands on the version just made.
        setBase({ id: v.id, number: v.version_number, content: v.content });
      } catch {
        // The draft is still kept; the next time round tries again.
      } finally {
        sending = null;
      }
    };
    const hide = () => document.visibilityState === "hidden" && void persist();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", persist);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", persist);
      if (idleVersion.current) clearTimeout(idleVersion.current);
      void persist(); // an in-app move to another page
    };
  }, [sharedWords]);
  /**
   * Preview shows what readers would get — and what Publish publishes: the latest version. Words written since (the
   * autosaved draft) are saved as a version first, so Preview always has the latest (owner, 5 Oct 2026).
   */
  async function openPreview(e: React.MouseEvent) {
    if (!dirty || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (await saveVersion({ name: "Before preview", keepUnused: true })) router.push(`/creations/${artifact.id}/preview`);
  }

  // "Use this" results (owner, 28 Sep 2026): what the chosen uses did, said once; and news for the carousel canvas.
  const [news, setNews] = useState<CanvasNews | null>(null);
  const newsSeq = useRef(0);
  const [usedNote, setUsedNote] = useState<string | null>(null);
  const [madeFromSeen, setMadeFromSeen] = useState(false);
  async function applyUses(rows: WorkingSource[]) {
    if (!set || !rows.length) return;
    setUsedNote(null);
    const notes: string[] = [];
    const words: string[] = [];
    const steer: WorkingSource[] = [];
    let part: WorkingSource | null = null;
    const start = Math.max(0, slides.ids.indexOf(slides.current ?? ""));
    let k = 0;
    try {
      for (const row of rows) {
        const slideId = slides.ids.length ? slides.ids[Math.min(start + k, slides.ids.length - 1)] : null;
        const r = await api<{ kind: string; slideId?: string; message?: string; text?: string; live?: boolean }>(`/api/v1/studio-sessions/${set.sessionId}/sources/${row.id}/apply`, {
          method: "POST",
          json: { slideId },
        });
        if (r.kind === "slide_image" || r.kind === "slide_words" || r.kind === "slide_proposal") {
          k += 1;
          setNews({ key: ++newsSeq.current, slideId: r.slideId!, proposal: r.kind === "slide_proposal" ? { text: r.text ?? "", live: !!r.live } : null });
          notes.push(r.kind === "slide_proposal" ? `New words from “${row.title}” are on the slide — keep them or not.` : (r.message ?? ""));
        } else if (r.kind === "draft_words" && r.text) words.push(r.text);
        else if (r.kind === "refine") steer.push(row);
        else if (r.kind === "choose_part") part = row;
        else if (r.message) notes.push(r.message);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
    // Writing: steering first (CreativeMind works on the saved version), then the words go into the draft.
    if (steer.length) {
      await refine(
        { key: "use-sources", label: "Use sources", instruction: `Rework the draft using ${steer.length === 1 ? "this source" : "these sources"} as described for each.` },
        steer.map((r) => r.id),
      );
      notes.push(`CreativeMind is working ${steer.length === 1 ? `“${steer[0]!.title}”` : `${steer.length} sources`} into it — review the revision.`);
    }
    if (words.length) {
      setMode("edit");
      onType(`${content.trim() ? `${content.trimEnd()}\n\n` : ""}${words.join("\n\n")}`);
      notes.push(words.length === 1 ? "Its words are in your draft." : "Their words are in your draft.");
    }
    if (part) setFragmentsFor(part);
    setUsedNote(notes.filter(Boolean).join(" ") || null);
  }

  // One-tap actions under each material in "Used materials" (owner board, 29 Sep 2026).
  async function runAction(row: WorkingSource, action: MaterialAction) {
    if (!set) return;
    setUsedNote(null);
    setError(null);
    try {
      const r = await api<{ kind: string; slideId?: string | null; message?: string; text?: string; live?: boolean }>(`/api/v1/studio-sessions/${set.sessionId}/sources/${row.id}/apply`, {
        method: "POST",
        json: { action, slideId: slides.current },
      });
      if ((r.kind === "slide_image" || r.kind === "slide_words" || r.kind === "slide_added" || r.kind === "slide_proposal") && r.slideId) {
        setNews({ key: ++newsSeq.current, slideId: r.slideId, proposal: r.kind === "slide_proposal" ? { text: r.text ?? "", live: !!r.live } : null });
      }
      if (r.kind === "slide_proposal") setUsedNote(`New words from “${row.title}” are on the slide — keep them or not.`);
      else if (r.kind === "draft_words" && r.text) {
        setMode("edit");
        onType(`${content.trim() ? `${content.trimEnd()}\n\n` : ""}${r.text}`);
        setUsedNote("Its words are in your draft.");
      } else if (r.kind === "refine") {
        await refine({ key: "use-sources", label: "Use sources", instruction: "Rework the draft using this source as described." }, [row.id]);
        setUsedNote(`CreativeMind is working “${row.title}” into it — review the revision.`);
      } else if (r.kind === "choose_part") setFragmentsFor(row);
      else if (r.message) setUsedNote(r.message);
      if (r.kind === "cover") router.refresh();
      const fresh = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${set.sessionId}`);
      setSet(fresh.workingSet);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // A royalty-free picture brought in from the Working Table's External tab: a short toast, then the table catches up.
  const [toast, setToast] = useState<{ key: number; text: string; thumbUrl: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast((x) => (x?.key === toast.key ? null : x)), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  async function externalAdded(r: ExternalAdded) {
    setToast({ key: Date.now(), text: r.message, thumbUrl: r.thumbUrl });
    if (r.slideId) setNews({ key: ++newsSeq.current, slideId: r.slideId, proposal: null });
    if (!set) return;
    try {
      const fresh = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${set.sessionId}`);
      setSet(fresh.workingSet);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function refine(a: { key: string; label: string; instruction?: string } | null, sourceIds?: string[]) {
    if (dirty) {
      setError("Save a version first — CreativeMind works on your latest saved version.");
      setSheet("save");
      return;
    }
    const text = a?.instruction ?? (a ? `${a.label}${instruction.trim() ? `: ${instruction.trim()}` : ""}` : instruction.trim());
    if (!text) return;
    setWorking(a?.key ?? "custom");
    setError(null);
    try {
      const r = await api<{ kind: "version" | "proposal"; versionId?: string; versionNumber?: number; proposal?: { id: string }; preview?: string }>(`/api/v1/artifacts/${artifact.id}/refine`, {
        method: "POST",
        json: { instruction: text, action: a?.key, ...(sourceIds?.length ? { sourceIds } : {}) },
      });
      if (r.kind === "proposal" && r.proposal) setProposal({ id: r.proposal.id, preview: r.preview ?? "", baseVersionId: base?.id ?? "" });
      else router.refresh();
      setInstruction("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }
  async function decide(decision: "approve" | "reject") {
    if (!proposal) return;
    setWorking(decision);
    setError(null);
    try {
      const r = await api<{ versionId?: string; versionNumber?: number }>(`/api/v1/brain/proposals/${proposal.id}`, { method: "POST", json: { decision } });
      if (decision === "approve" && r.versionId) {
        setContent(proposal.preview);
        setBase({ id: r.versionId, number: r.versionNumber ?? (base?.number ?? 0) + 1, content: proposal.preview });
        setKept({ versionNumber: r.versionNumber ?? (base?.number ?? 0) + 1, titles: proposal.quality?.titles ?? [] });
      } else setKept(null);
      setProposal(null);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }
  async function regenerate() {
    if (!proposal?.quality) return;
    const { reportId, keys, titles } = proposal.quality;
    setWorking("regenerate");
    setError(null);
    try {
      await api(`/api/v1/brain/proposals/${proposal.id}`, { method: "POST", json: { decision: "reject" } });
      setProposal(null);
      const r = await api<{ proposal?: { id: string }; preview?: string }>(`/api/v1/artifacts/${artifact.id}/quality/apply`, { method: "POST", json: { reportId, keys } });
      if (r.proposal) setProposal({ id: r.proposal.id, preview: r.preview ?? "", baseVersionId: base?.id ?? "", quality: { reportId, keys, titles } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }
  async function review() {
    setWorking("quality");
    setError(null);
    try {
      const r = await api<{ reportId: string; versionId: string; checks: QualityReportView["checks"]; findings: QualityReportView["findings"] }>(`/api/v1/artifacts/${artifact.id}/quality`, {
        method: "POST",
      });
      setQ({ reportId: r.reportId, versionId: r.versionId, checks: r.checks, findings: r.findings });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }

  /* ------------------------------------------------------------ CreativeMind: one bubble at a time */
  // The "Possible connection" popup is gone (owner, 29 Sep 2026); only the quiet unused nudge remains.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const nudge = inUse > 0 ? unusedNudge(sources) : null;
  const nudgeKey = nudge ? `nudge:${nudge.count}` : null;
  const thumbs = sources.filter((x) => x.available && x.state !== "available" && x.thumbnailUrl).slice(0, 4);
  const showNudge = nudge && nudgeKey && !dismissed.has(nudgeKey);

  const modeLabel = OUTPUT_MODES.find((m) => m.key === outputModeOf(artifact.type))?.label ?? "Writing";
  // The Writing page (creation-pages.md): verse centred in Playfair with room between lines; scripts in their mono layout.
  const writing = page === "writing";
  const [linkCopied, setLinkCopied] = useState(false);
  // The Images page: Edit is the primary action, Text and Download the two secondaries (creation-pages.md, step 2).
  const imagesPage = page === "images";
  const hasPictures = !!images?.set.items.length;
  const [imgReq, setImgReq] = useState<ImagesRequest>(null);
  const askImages = (kind: NonNullable<ImagesRequest>["kind"]) => {
    setSheet(null);
    setImgReq((r) => ({ kind, n: (r?.n ?? 0) + 1 }));
  };
  // The Presentation page: Edit slide is the primary action, Add slide and Present the two secondaries.
  const deckPage = page === "presentation";
  const hasSlides = !!deck?.deck.slides.length;
  // The canvas hands its controls over through a callback ref, so the header and sheets can call them from their handlers.
  const [deckControls, setDeckControls] = useState<DeckControls | null>(null);
  const askDeck = (kind: keyof DeckControls) => {
    setSheet(null);
    deckControls?.[kind]();
  };
  // The Video page: Write is the primary action, Add shot and Play through the two secondaries; Render under More.
  const videoPage = page === "video";
  const hasShots = !!video?.storyboard.shots.length;
  const [videoControls, setVideoControls] = useState<VideoControls | null>(null);
  const askVideo = (kind: keyof VideoControls) => {
    setSheet(null);
    videoControls?.[kind]();
  };
  // The Audio page: Record is the primary action, Listen (the page readers would hear) and Download the two secondaries.
  const audioPage = page === "audio";
  const take = audio?.take ?? null;
  const [audioReq, setAudioReq] = useState<AudioRequest>(null);
  const record = () => {
    setSheet(null);
    setAudioReq((r) => ({ kind: "record", n: (r?.n ?? 0) + 1 }));
  };
  const verse = artifact.format === "verse";
  // Each kind of writing is set after the publications that set it best (creation-pages.md §Writing kinds).
  const style = writingStyleOf(artifact.type);
  const editorFont =
    artifact.format === "screenplay"
      ? "font-mono text-[14px] leading-7"
      : verse
        ? writing
          ? "text-center font-display text-[17px] leading-[1.95] sm:text-[20px]"
          : "font-display text-[19px] leading-8"
        : writing && style === "news"
          ? "font-sans text-[16px] leading-7"
          : "font-display text-[18px] leading-8";
  // How the words are set — over the cover, over it blurred, or on paper — chosen in Cover and kept with the Creation.
  const [look, setLook] = useState<CreationLook>(artifact.look);
  const [lookFrom, setLookFrom] = useState(artifact.look);
  if (artifact.look !== lookFrom) {
    setLookFrom(artifact.look);
    setLook(artifact.look);
  }
  async function chooseLook(l: CreationLook) {
    setLook(l);
    try {
      await api(`/api/v1/artifacts/${artifact.id}`, { method: "PATCH", json: { presentation: { look: l } } });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  // The Roman ornament that heads and closes the piece (owner, 4 Oct 2026), chosen in Cover beside the look.
  const [ornament, setOrnament] = useState<OrnamentKey | undefined>(artifact.ornament);
  const [ornamentFrom, setOrnamentFrom] = useState(artifact.ornament);
  if (artifact.ornament !== ornamentFrom) {
    setOrnamentFrom(artifact.ornament);
    setOrnament(artifact.ornament);
  }
  async function chooseOrnament(o: OrnamentKey) {
    setOrnament(o);
    try {
      await api(`/api/v1/artifacts/${artifact.id}`, { method: "PATCH", json: { presentation: { ornament: o } } });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  // A new cover shows: off paper, onto the picture. No cover sets the words on paper.
  async function chooseCover(materialId: string | null) {
    await api(`/api/v1/artifacts/${artifact.id}`, { method: "PATCH", json: { coverMaterialId: materialId, ...(materialId && look === "paper" ? { presentation: { look: "cover" } } : {}) } });
    setSheet(null);
    setMode("view");
    router.refresh();
  }
  // The kind of writing (a poem, an essay, news…) can change any time; the words stay, the page is set to suit them.
  const [kindBusy, setKindBusy] = useState<string | null>(null);
  async function chooseKind(type: string) {
    if (type === artifact.type) return setSheet(null);
    setKindBusy(type);
    try {
      await api(`/api/v1/artifacts/${artifact.id}`, { method: "PATCH", json: { artifactType: type } });
      setSheet(null);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setKindBusy(null);
    }
  }
  const kindButton = (light: boolean) => (
    <button
      type="button"
      onClick={() => setSheet("kind")}
      aria-haspopup="dialog"
      aria-label={`Kind of writing: ${artifact.typeLabel}`}
      className={cn("-my-3 inline-flex min-h-11 items-center gap-1 uppercase tracking-[inherit] hover:underline", light ? "text-white/85" : "")}
    >
      {artifact.typeLabel}
      <ChevronDown className="size-3" aria-hidden />
    </button>
  );
  const isCarousel = artifact.type === "carousel" && carousel;
  // "Arrange slides" (More sheet) asks the carousel canvas to open Arrange; each ask is a new number.
  const [arrangeReq, setArrangeReq] = useState(0);
  const saveLabel = saving ? "Saving…" : savedAt ? "Autosaved" : dirty ? "Unsaved" : "Saved";
  // Ask Community (Phase 04 §13) is about one part: the slide on screen, the selected passage, or the opening.
  const opening = content.split(/\n\s*\n/).find((p) => p.trim())?.trim() ?? "";
  const askFragment: AskFragment | null = isCarousel
    ? slides.current && slides.text
      ? { label: `Slide ${slides.index + 1}`, text: slides.text, slideId: slides.current }
      : null
    : selection.trim()
      ? { label: "A passage", text: selection.trim() }
      : opening
        ? { label: "The opening", text: opening }
        : null;

  return (
    // --canvas-extra: what else takes height above the canvas (the offline notice), so the carousel canvas can size itself.
    // The page scrolls only when there's something below (owner, 29 Sep 2026): instead of the app's Palette clearance plus
    // its own, the Studio keeps just the room its fixed bottom bar needs.
    <div className="mx-auto -mb-[calc(var(--palette-clearance)+env(safe-area-inset-bottom)+1rem)] max-w-3xl pb-[calc(4.25rem+env(safe-area-inset-bottom))]" style={{ ["--canvas-extra" as string]: offline ? "4rem" : "0rem" }}>
      {/* Top bar (§6, §65): back · the Creation and its version · autosaved · who's on it · more. */}
      <header className="mb-2 flex items-center gap-1.5">
        {/* Back goes where the creator came from (back-navigation.md): the Room, Home, the Creation page… Its home, when
            the tab has no trail: a part's Room; else the Creation page (a Carousel's Creation page is this Studio, so
            its home is the Creations list). */}
        <BackLink
          variant="icon"
          home={part ? `/rooms/${part.project.id}` : isCarousel ? "/materials?tab=creations" : `/creations/${artifact.id}`}
          homeLabel={part ? part.project.title : isCarousel ? "Creations" : title || "the Creation"}
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex min-w-0 items-center gap-1.5 rounded-full bg-surface/90 py-1 pl-3 pr-1.5 ring-1 ring-border-soft">
            <label htmlFor="title" className="sr-only">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              maxLength={200}
              className="min-w-0 max-w-[10rem] bg-transparent text-[13.5px] font-medium text-ink focus:outline-none sm:max-w-xs"
            />
            <Link
              href={`/creations/${artifact.id}?tab=versions`}
              className="rounded-full bg-accent-softer px-2 py-0.5 text-[11.5px] font-semibold text-accent-ink"
              aria-label={`Version ${base?.number ?? 1} — see versions`}
            >
              v{base?.number ?? 1}
            </Link>
          </div>
          <p className="hidden truncate text-[12.5px] text-ink-subtle sm:block" aria-live="polite">
            {saveLabel}
          </p>
        </div>
        {/* Save stays visible while the text differs from the last version (minimalism: Save is never hidden). It opens
            "Save as new version"; the draft itself autosaves. Soft accent, so Bring in stays the one purple action. */}
        {dirty && !isCarousel && !proposal ? (
          <button type="button" onClick={() => setSheet("save")} aria-haspopup="dialog" className="inline-flex min-h-11 shrink-0 items-center">
            <span className="inline-flex h-8 items-center rounded-full bg-accent-soft px-3.5 text-[13px] font-semibold text-accent-ink ring-1 ring-accent/25 hover:bg-accent-softer">Save</span>
          </button>
        ) : null}
        <span role="group" className="flex -space-x-2" aria-label={`${people.length} on this Creation`}>
          {people.slice(0, 3).map((p) => (
            <Avatar key={p.id} name={p.name} src={p.avatarUrl} size={28} className="ring-2 ring-background" />
          ))}
        </span>
        <button
          type="button"
          aria-label="More"
          aria-haspopup="dialog"
          onClick={() => setSheet("more")}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-black/5"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </header>

      {/* Second line: autosave on phones, and the format lens (§24–26). */}
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[12px] text-ink-subtle sm:hidden" aria-hidden>
          {saveLabel}
        </p>
        {audioPage ? (
          <div className="ml-auto flex items-center gap-1.5">
            {take ? (
              <Link href={`/creations/${artifact.id}/preview`} onClick={(e) => void openPreview(e)} aria-busy={working === "version"} className="inline-flex min-h-11 items-center">
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface/90 px-3 text-[12.5px] font-medium text-ink hover:bg-surface">
                  <Headphones className="size-4 text-ink-muted" aria-hidden />
                  Listen
                </span>
              </Link>
            ) : null}
            {/* Publish the finished piece — the take, or the take with its music — on its own page and the Creator Page
                (owner, 6 Oct 2026); Download moved to More. */}
            {take?.url ? (
              <button type="button" onClick={() => setSheet("publish")} className="inline-flex min-h-11 items-center">
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface/90 px-3 text-[12.5px] font-medium text-ink hover:bg-surface">
                  <Upload className="size-4 text-ink-muted" aria-hidden />
                  Publish
                </span>
              </button>
            ) : null}
          </div>
        ) : videoPage ? (
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => askVideo("add")} className="inline-flex min-h-11 items-center">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface/90 px-3 text-[12.5px] font-medium text-ink hover:bg-surface">
                <Plus className="size-4 text-ink-muted" aria-hidden />
                Add shot
              </span>
            </button>
            <button type="button" onClick={() => askVideo("play")} disabled={!hasShots} className="inline-flex min-h-11 items-center disabled:opacity-50">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface/90 px-3 text-[12.5px] font-medium text-ink hover:bg-surface">
                <Clapperboard className="size-4 text-ink-muted" aria-hidden />
                Play through
              </span>
            </button>
          </div>
        ) : deckPage ? (
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => askDeck("add")} className="inline-flex min-h-11 items-center">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface/90 px-3 text-[12.5px] font-medium text-ink hover:bg-surface">
                <Plus className="size-4 text-ink-muted" aria-hidden />
                Add slide
              </span>
            </button>
            <button type="button" onClick={() => askDeck("present")} disabled={!hasSlides} className="inline-flex min-h-11 items-center disabled:opacity-50">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface/90 px-3 text-[12.5px] font-medium text-ink hover:bg-surface">
                <Presentation className="size-4 text-ink-muted" aria-hidden />
                Present
              </span>
            </button>
          </div>
        ) : imagesPage ? (
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => askImages("text")} disabled={!hasPictures} className="inline-flex min-h-11 items-center disabled:opacity-50">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface/90 px-3 text-[12.5px] font-medium text-ink hover:bg-surface">
                <Type className="size-4 text-ink-muted" aria-hidden />
                Text
              </span>
            </button>
            <button type="button" onClick={() => askImages("download")} aria-haspopup="dialog" disabled={!hasPictures} className="inline-flex min-h-11 items-center disabled:opacity-50">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface/90 px-3 text-[12.5px] font-medium text-ink hover:bg-surface">
                <Download className="size-4 text-ink-muted" aria-hidden />
                Download
              </span>
            </button>
          </div>
        ) : writing ? (
          // The Writing page's two secondary actions: its cover (and how the words are set), and reading it on its own.
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => setSheet("cover")} aria-haspopup="dialog" className="inline-flex min-h-11 items-center">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface/90 px-3 text-[12.5px] font-medium text-ink hover:bg-surface">
                <ImageIcon className="size-4 text-ink-muted" aria-hidden />
                Cover
              </span>
            </button>
            {/* Preview (owner, 4 Oct 2026): the page readers would see, with Publish beneath — the clearest "what's next". */}
            <Link href={`/creations/${artifact.id}/preview`} onClick={(e) => void openPreview(e)} aria-busy={working === "version"} className="inline-flex min-h-11 items-center">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface/90 px-3 text-[12.5px] font-medium text-ink hover:bg-surface">
                <Eye className="size-4 text-ink-muted" aria-hidden />
                {working === "version" ? "Saving…" : "Preview"}
              </span>
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSheet("format")}
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface/90 px-3 text-[12.5px] font-medium text-ink hover:bg-surface"
            aria-haspopup="dialog"
          >
            <KitArt art={KIT.iconChip[MODE_ICON[outputModeOf(artifact.type)] ?? "type"]} sizes="1.25rem" className="size-5" />
            {modeLabel}
            <ChevronDown className="size-3.5 text-ink-subtle" aria-hidden />
          </button>
        )}
      </div>

      {offline ? (
        <p className="mb-2 rounded-2xl border border-[#f6dfb6] bg-warning-soft px-4 py-2 text-[13px] text-warning-ink">
          Offline development model: CreativeMind actions produce placeholder revisions.
        </p>
      ) : null}
      {error || wsError ? <ErrorState title="That didn't work" body={error ?? wsError ?? ""} className="mb-2" /> : null}
      {kept ? (
        <p role="status" className="mb-2 flex flex-wrap items-center gap-x-3 rounded-2xl bg-success-soft px-4 py-2 text-sm text-success-ink">
          Saved as v{kept.versionNumber}
          {kept.titles.length ? ` with: ${kept.titles.join("; ")}` : ""}.
          <Link href={`/creations/${artifact.id}?tab=versions`} className="inline-flex min-h-11 items-center font-medium underline">
            Compare with the previous version
          </Link>
        </p>
      ) : null}

      {published && writing ? (
        <p role="status" className="mb-2 flex items-center gap-2 rounded-2xl bg-success-soft px-3 py-1.5 text-[13px] text-success-ink">
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">Published</span> · {published.url.replace(/^https?:\/\//, "")}
            {published.newer ? <span className="text-ink-muted"> · newer words here — Preview to publish them</span> : null}
          </span>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(published.url).then(() => setLinkCopied(true))} className="inline-flex min-h-11 items-center gap-1 font-medium hover:underline">
            {linkCopied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {linkCopied ? "Copied" : "Copy"}
          </button>
        </p>
      ) : null}
      {madeFrom && !madeFromSeen ? (
        <p role="status" className="mb-2 flex items-center gap-2 rounded-2xl bg-accent-softer px-3 py-1 text-[13px] text-ink">
          <Sparkles className="size-4 shrink-0 text-accent" aria-hidden />
          <span className="flex-1">
            A new Creation. “{madeFrom.title}” is unchanged —{" "}
            <Link href={`/creations/${madeFrom.id}/studio`} className="inline-flex min-h-11 items-center font-medium underline">
              open it
            </Link>
          </span>
          <button type="button" aria-label="Dismiss" onClick={() => setMadeFromSeen(true)} className="inline-flex size-9 items-center justify-center rounded-full text-ink-subtle hover:bg-black/5">
            <X className="size-4" aria-hidden />
          </button>
        </p>
      ) : null}
      {part ? <PartNotice part={part} onChanges={(other) => setPartSheet({ kind: "changes", other })} /> : null}
      {/* Play-along while writing or shaping (step 3); the Audio page shows it with the recording instead. */}
      {playAlong?.tracks.length && !audioPage ? <PlayAlongBar tracks={playAlong.tracks} className="mb-2" /> : null}

      {usedNote ? (
        <p role="status" className="mb-2 flex items-start gap-2 rounded-2xl bg-accent-softer px-3 py-2 text-[13px] text-ink">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <span className="flex-1">{usedNote}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setUsedNote(null)} className="-my-1 inline-flex size-8 items-center justify-center rounded-full text-ink-subtle hover:bg-black/5">
            <X className="size-4" aria-hidden />
          </button>
        </p>
      ) : null}

      {/* The canvas */}
      {isCarousel ? (
        <section aria-label="Editor">
          <CarouselCanvas artifactId={artifact.id} initial={carousel} arrangeRequest={arrangeReq} onSlides={setSlides} news={news} />
        </section>
      ) : (
        <section aria-label="Editor" className="relative overflow-hidden rounded-3xl border border-border-soft bg-surface shadow-[var(--shadow-card)]">
          {videoPage && video ? (
            <VideoCanvas
              artifactId={artifact.id}
              initial={video.storyboard}
              frames={video.frames}
              baseVersionId={base?.id ?? null}
              controls={setVideoControls}
              onKept={(v) => {
                setBase({ id: v.id, number: v.version_number, content: v.content });
                setContent(v.content);
                setSavedVersion(v.version_number);
              }}
            />
          ) : deckPage && deck ? (
            <DeckCanvas
              artifactId={artifact.id}
              title={title || artifact.title}
              initial={deck.deck}
              pictures={deck.pictures}
              baseVersionId={base?.id ?? null}
              controls={setDeckControls}
              onKept={(v) => {
                setBase({ id: v.id, number: v.version_number, content: v.content });
                setContent(v.content);
                setSavedVersion(v.version_number);
              }}
            />
          ) : imagesPage && images ? (
            <ImagesCanvas
              artifactId={artifact.id}
              title={title || artifact.title}
              set={images.set}
              pictures={images.pictures}
              baseVersionId={base?.id ?? null}
              request={imgReq}
              onKept={(v) => {
                setBase({ id: v.id, number: v.version_number, content: v.content });
                setContent(v.content);
                setSavedVersion(v.version_number);
              }}
            />
          ) : proposal ? (
            <div className="p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-accent-softer px-4 py-3">
                <div className="min-w-0 text-[15px] text-ink">
                  <p>
                    <Sparkles className="mr-1.5 inline size-4 text-accent-ink" aria-hidden />
                    {proposal.quality ? "Preview of the suggestions you chose." : "CreativeMind suggested a revision."} Your current version stays in history either way.
                  </p>
                  {proposal.quality ? <p className="mt-1 text-sm text-ink-muted">Applying: {proposal.quality.titles.join("; ")}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" loading={working === "approve"} disabled={!!working} onClick={() => decide("approve")}>
                    Keep revision
                  </Button>
                  {proposal.quality ? (
                    <Button size="sm" variant="secondary" loading={working === "regenerate"} disabled={!!working} onClick={regenerate}>
                      Try another version
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" loading={working === "reject"} disabled={!!working} onClick={() => decide("reject")}>
                    Discard
                  </Button>
                </div>
              </div>
              <Segmented
                label="Show"
                value={view}
                onChange={setView}
                options={[
                  { value: "changes", label: "Changes" },
                  { value: "original", label: `Original (v${base?.number ?? 1})` },
                  { value: "proposed", label: "Proposed" },
                ]}
                className="mb-3"
              />
              {view === "changes" ? (
                <div aria-label="Changes" role="region" className="max-h-[65vh] overflow-auto rounded-2xl bg-surface-muted p-4 font-mono text-[13px] leading-relaxed">
                  {diffLines(base?.content ?? "", proposal.preview).map((d, i) => (
                    <div
                      key={i}
                      className={cn(
                        "whitespace-pre-wrap px-2",
                        d.kind === "added" && "bg-success-soft text-success-ink",
                        d.kind === "removed" && "bg-danger-soft text-danger line-through decoration-danger/40",
                      )}
                    >
                      <span className="sr-only">{d.kind === "added" ? "Added: " : d.kind === "removed" ? "Removed: " : ""}</span>
                      {d.text || " "}
                    </div>
                  ))}
                </div>
              ) : (
                <article
                  aria-label={view === "original" ? "Original" : "Proposed"}
                  className={cn("max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-muted px-5 py-6 text-ink sm:px-8", editorFont)}
                >
                  {(view === "original" ? base?.content : proposal.preview) || "Empty."}
                </article>
              )}
            </div>
          ) : mode === "view" && writing && !audioPage ? (
            // The Writing page (creation-pages.md): the words set over the cover, over it blurred, or on paper. They scroll.
            <div
              className="relative h-[calc(100dvh-var(--nav-height)-var(--canvas-extra)-9.75rem)] min-h-[22rem] bg-[#f7f2ea]"
              style={look === "paper" ? { backgroundImage: `url(${KIT.texture.texturePaper.svg})`, backgroundSize: "512px" } : undefined}
            >
              {look !== "paper" && artifact.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artifact.coverUrl} alt="" className={cn("absolute inset-0 size-full object-cover", look === "blur" && "scale-110 blur-2xl")} />
              ) : null}
              {look === "cover" ? (
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,18,40,0.35)_0%,rgba(20,18,40,0.6)_40%,rgba(20,18,40,0.88)_100%)]" />
              ) : look === "blur" ? (
                <span aria-hidden className="absolute inset-0 bg-[#f7f2ea]/15" />
              ) : null}
              <div
                tabIndex={0}
                aria-label={`${title || "Untitled"}, read`}
                className={cn(
                  "absolute inset-0 overflow-y-auto overscroll-contain px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent sm:px-8",
                  look === "cover" ? "pt-[18vh] text-white" : "pt-8 text-ink sm:pt-12",
                )}
              >
                <div
                  className={cn(
                    look === "blur" && "mx-auto max-w-[36rem] rounded-[26px] bg-[#f7f2ea]/80 px-4 py-7 shadow-[0_24px_60px_-28px_rgba(40,30,20,0.55)] backdrop-blur-md sm:px-10 sm:py-10",
                    look === "paper" && "mx-auto max-w-[36rem] px-1",
                    look === "cover" && "mx-auto max-w-[36rem]",
                  )}
                >
                  <WrittenPiece
                    style={style}
                    kicker={kindButton(look === "cover")}
                    title={title || "Untitled"}
                    text={content}
                    byline={people[0]?.name}
                    date={artifact.updatedAt}
                    tone={look === "cover" ? "light" : "ink"}
                    empty="Nothing written yet. Tap Write to start."
                    ornament={ornament}
                  />
                </div>
              </div>
            </div>
          ) : mode === "view" && !audioPage ? (
            // Immersive reading (board §1; owner, 3 Oct 2026: "capture the full canvas… the text should scroll so one can
            // read the full text"): the Creation over its cover, filling the screen; the words scroll over the picture.
            // The pen (below) edits; the corner button opens it on a page of its own.
            <div className="relative h-[calc(100dvh-var(--nav-height)-var(--canvas-extra)-9.75rem)] min-h-[22rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artifact.coverUrl ?? BACKGROUNDS.coastalVillage} alt="" className="absolute inset-0 size-full object-cover" />
              <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,18,40,0.35)_0%,rgba(20,18,40,0.6)_40%,rgba(20,18,40,0.88)_100%)]" />
              <div tabIndex={0} aria-label={`${title || "Untitled"}, read`} className="absolute inset-0 overflow-y-auto overscroll-contain px-5 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-[18vh] text-white [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white sm:px-8">
                <h2 className="font-display text-[34px] leading-[1.05] [text-shadow:0_1px_14px_rgba(0,0,0,0.45)] sm:text-[44px]">{title || "Untitled"}</h2>
                <p
                  className={cn(
                    "mt-4 whitespace-pre-wrap text-white/95 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]",
                    artifact.format === "verse" ? "font-display text-[19px] leading-8" : "font-display text-[17px] leading-7",
                  )}
                >
                  {content || "Nothing written yet. Tap the pen to start."}
                </p>
              </div>
              <Link
                href={`/creations/${artifact.id}/read`}
                aria-label="Open it on its own page"
                className="absolute right-2.5 top-2.5 inline-flex size-11 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm hover:bg-black/40"
              >
                <Maximize2 className="size-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <>
              {audioPage ? (
                <AudioPanel
                  artifactId={artifact.id}
                  take={take}
                  baseVersionId={base?.id ?? null}
                  words={content}
                  request={audioReq}
                  onKept={(v) => {
                    setBase({ id: v.id, number: v.version_number, content: v.content });
                    setSavedVersion(v.version_number);
                  }}
                  onUseTranscript={(text) => onType(text)}
                  playAlong={playAlong}
                />
              ) : null}
              {writing ? (
                // The kind, above the words while writing too: a poem, an essay, news… changes how the page is set.
                <div className="absolute left-5 top-4 z-10 text-[11px] font-semibold tracking-[0.16em] text-ink-subtle sm:left-10 sm:top-6">{kindButton(false)}</div>
              ) : null}
              <label htmlFor="editor" className="sr-only">
                {artifact.typeLabel} text
              </label>
              <textarea
                id="editor"
                value={content}
                onChange={(e) => onType(e.target.value)}
                onSelect={(e) => setSelection(e.currentTarget.value.slice(e.currentTarget.selectionStart, e.currentTarget.selectionEnd).trim().slice(0, 600))}
                onBlur={() => setTimeout(() => setSelection(""), 200)}
                autoFocus={!!version?.content}
                spellCheck
                className={cn(
                  // The bottom bar floats over the canvas: room beneath the last line so it can always scroll into view.
                  "block min-h-[22rem] w-full resize-none rounded-3xl bg-transparent px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 text-ink focus:outline-none sm:px-10 sm:pt-10",
                  audioPage ? "min-h-[16rem] h-[calc(100dvh-var(--nav-height)-var(--canvas-extra)-16rem)]" : "h-[calc(100dvh-var(--nav-height)-var(--canvas-extra)-9.75rem)]",
                  writing && "pt-14 sm:pt-16",
                  editorFont,
                )}
                style={writing ? { backgroundImage: `url(${KIT.texture.texturePaper.svg})`, backgroundSize: "512px" } : undefined}
                placeholder={audioPage ? "The words — a script, lyrics, or notes for listeners…" : writing ? (verse ? "The first line…" : artifact.format === "screenplay" ? "INT. A ROOM — NIGHT" : "Begin anywhere…") : "Start with anything…"}
              />
            </>
          )}
        </section>
      )}

      {/* Refine + quality (owner, 3 Oct 2026: "no need of quality and other options on the page, keep it minimal, focus on
          content"): a sheet from More, or the Palette's Refine (#creativemind). It closes once a revision is on the canvas. */}
      <Dialog open={sheet === "refine" && !isCarousel} onOpenChange={(o) => !o && setSheet(null)}>
        <DialogContent title="Refine with CreativeMind" description="Suggestions only. Nothing changes until you keep a revision." art={KIT.iconChip.sparkles}>
        <section id="creativemind" aria-labelledby="creativemind-title" className="space-y-3">
          <h2 id="creativemind-title" className="sr-only">
            Refine with CreativeMind
          </h2>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Suggestions">
            {actions.map((a) => (
              <li key={a.key} className="shrink-0">
                <button
                  type="button"
                  disabled={!!working || !!proposal}
                  title={a.hint}
                  onClick={() => (a.kind === "transform" ? setSheet("format") : refine(a))}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-soft bg-surface px-4 text-sm font-medium text-ink hover:border-[#cfd0ff] hover:bg-accent-softer disabled:opacity-50"
                >
                  {a.kind === "transform" ? <Wand2 className="size-4 shrink-0 text-accent-ink" aria-hidden /> : <Sparkles className="size-4 shrink-0 text-accent-ink" aria-hidden />}
                  {working === a.key ? "Working…" : a.label}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void refine(null);
            }}
          >
            <label htmlFor="instruction" className="sr-only">
              Describe what you want to change
            </label>
            <Input id="instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Describe what to change…" disabled={!!working || !!proposal} />
            <Button type="submit" size="md" disabled={!instruction.trim() || !!working || !!proposal} loading={working === "custom"}>
              Go
            </Button>
          </form>
          <QualityPanel
            artifactId={artifact.id}
            report={q}
            currentVersionId={base?.id ?? null}
            blocked={dirty ? "Save a version first to apply suggestions." : proposal ? "Keep or discard the current revision first." : null}
            reviewing={working === "quality"}
            onReview={review}
            onPreview={(p) => setProposal(p)}
            onChanged={() => router.refresh()}
          />
        </section>
        </DialogContent>
      </Dialog>

      {/* One quiet CreativeMind nudge about what's unused (§31–32). */}
      {/* On a Carousel the slide strip sits right above the bar, so the nudge lives in the bar itself (below). */}
      {showNudge && !isCarousel ? (
        <div className="fixed inset-x-3 bottom-[4.75rem] z-20 mx-auto max-w-3xl motion-safe:animate-[fade-in_160ms_ease-out]" role="status">
          <div className="flex items-start gap-2.5 rounded-2xl border border-border-soft bg-surface/95 p-3 pr-2 shadow-[var(--shadow-card)] backdrop-blur">
            <KitArt art={KIT.iconChip.sparkles} sizes="2rem" className="size-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink">Unused possibilities</p>
              <p className="text-[13.5px] leading-snug text-ink">{nudge!.text}</p>
              <div className="mt-1.5">
                <Button size="sm" variant="secondary" onClick={() => setSheet("table-available")}>
                  See them
                </Button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setDismissed((d) => new Set(d).add(nudgeKey!))}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-black/5"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {selection && mode === "edit" && !proposal ? (
        <div className="fixed inset-x-3 bottom-[4.75rem] z-20 mx-auto flex max-w-3xl justify-center" role="toolbar" aria-label="Selected text">
          <div className="flex items-center gap-1 rounded-full border border-border-soft bg-surface/95 p-1 shadow-[var(--shadow-card)] backdrop-blur">
            {(["Rewrite", "Expand", "Shorten"] as const).map((verb) => (
              <button
                key={verb}
                type="button"
                disabled={!!working}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => refine({ key: verb.toLowerCase(), label: `${verb} this passage`, instruction: `${verb} only this passage, keeping everything else as it is: "${selection}"` })}
                className="inline-flex h-9 min-w-11 items-center rounded-full px-3 text-[13px] font-medium text-ink hover:bg-accent-softer disabled:opacity-50"
              >
                {working === verb.toLowerCase() ? "Working…" : verb}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* In-use visuals (owner board "Fan + Preview Bubble"): a compact strip of the pictures on the table, above the
          Sources pill, in the cover view only. Tapping a picture opens the Working Set on what's In use; + brings more in. */}
      {/* Not on the Images page: its text toolbar sits there, and the Working Table bar already names the sources. */}
      {mode === "view" && !isCarousel && !imagesPage && !deckPage && !videoPage && !proposal && !showNudge && thumbs.length ? (
        <div className="pointer-events-none fixed inset-x-3 bottom-[4.25rem] z-20 mx-auto flex max-w-3xl">
          <ul className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border-soft bg-surface/85 p-1 shadow-[var(--shadow-card)] backdrop-blur" aria-label="Pictures in use">
            {thumbs.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSheet("table")}
                  aria-label={`${t.title} — on the Working Table`}
                  className="block h-11 w-14 overflow-hidden rounded-lg border border-border-soft bg-cream-deep focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.thumbnailUrl!} alt="" className="size-full object-cover" />
                </button>
              </li>
            ))}
            {thumbs.length < inUse ? <li className="px-1 text-xs text-ink-muted">+{inUse - thumbs.length}</li> : null}
          </ul>
        </div>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-3 bottom-[4.25rem] z-30 mx-auto flex max-w-3xl justify-center" role="status">
          <p className="flex items-center gap-2 rounded-full border border-border-soft bg-surface/95 py-1 pl-1 pr-3.5 text-[13px] text-ink shadow-[var(--shadow-card)] backdrop-blur motion-safe:animate-[fade-in_160ms_ease-out]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={toast.thumbUrl} alt="" className="size-8 rounded-full object-cover" />
            {toast.text}
          </p>
        </div>
      ) : null}

      {/* Bottom bar (§7, §64): pen · the Working Table bar (Sources N · M in use ^) */}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-20 mx-auto flex max-w-3xl items-center gap-2">
        {audioPage && !proposal ? (
          // Record: the Audio page's one primary action (Record again once there's a take; the earlier one is kept).
          <button type="button" onClick={record} aria-haspopup="dialog" className="pointer-events-auto inline-flex min-h-11 shrink-0 items-center">
            <span className={buttonClasses({ className: "h-11 gap-1.5 rounded-full px-4" })}>
              <Mic className="size-4" aria-hidden />
              {take ? "Record again" : "Record"}
            </span>
          </button>
        ) : videoPage ? (
          // Write: the Video page's one primary action (Add a shot until there is one).
          <button type="button" onClick={() => askVideo("write")} className="pointer-events-auto inline-flex min-h-11 shrink-0 items-center">
            <span className={buttonClasses({ className: "h-11 gap-1.5 rounded-full px-4" })}>
              {hasShots ? <PenLine className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              {hasShots ? "Write" : "Add a shot"}
            </span>
          </button>
        ) : deckPage ? (
          // Edit slide: the Presentation page's one primary action (Add a slide until there is one).
          <button type="button" onClick={() => askDeck("edit")} className="pointer-events-auto inline-flex min-h-11 shrink-0 items-center">
            <span className={buttonClasses({ className: "h-11 gap-1.5 rounded-full px-4" })}>
              {hasSlides ? <PenLine className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              {hasSlides ? "Edit slide" : "Add a slide"}
            </span>
          </button>
        ) : imagesPage ? (
          // Edit: the Images page's one primary action (Add a picture until there is one).
          <button type="button" onClick={() => askImages(hasPictures ? "edit" : "add")} aria-haspopup="dialog" className="pointer-events-auto inline-flex min-h-11 shrink-0 items-center">
            <span className={buttonClasses({ className: "h-11 gap-1.5 rounded-full px-4" })}>
              {hasPictures ? <SlidersHorizontal className="size-4" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
              {hasPictures ? "Edit" : "Add a picture"}
            </span>
          </button>
        ) : writing && !proposal ? (
          // Write: the page's one primary action. While writing, Done sets the words back on their cover or paper.
          <button type="button" onClick={() => setMode((m) => (m === "view" ? "edit" : "view"))} aria-pressed={mode === "edit"} className="pointer-events-auto inline-flex min-h-11 shrink-0 items-center">
            <span className={buttonClasses({ className: "h-11 gap-1.5 rounded-full px-4" })}>
              {mode === "view" ? <PenLine className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
              {mode === "view" ? "Write" : "Done"}
            </span>
          </button>
        ) : !isCarousel && !proposal ? (
          <button
            type="button"
            onClick={() => setMode((m) => (m === "view" ? "edit" : "view"))}
            aria-label={mode === "view" ? "Edit the text" : "Read it over the cover"}
            aria-pressed={mode === "edit"}
            className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-full border border-border-soft bg-surface/95 text-ink shadow-[var(--shadow-card)] backdrop-blur hover:bg-surface"
          >
            <PenLine className="size-4" aria-hidden />
          </button>
        ) : null}
        {/* The Working Table bar (owner board "Working Table Redesign", 29 Sep 2026): pulls the table up. It stops short
            of the corner so the Palette never covers it. */}
        <button
          type="button"
          onClick={() => setSheet("table")}
          aria-haspopup="dialog"
          aria-label={`Working Table: ${workingSetSummary(sources)}`}
          className="pointer-events-auto mr-16 inline-flex min-h-11 min-w-0 flex-1 items-center"
        >
          <span className="inline-flex h-11 w-full min-w-0 items-center gap-2 rounded-2xl border border-border-soft bg-surface/95 py-1 pl-1.5 pr-3 text-[13.5px] font-medium text-ink shadow-[var(--shadow-card)] backdrop-blur hover:bg-surface">
            <span aria-hidden className="flex shrink-0 -space-x-2">
              {sources.length ? (
                sources.slice(0, 3).map((s) => <SourceIcon key={s.id} s={s} size="size-8" ring />)
              ) : (
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-accent-softer">
                  <Sparkles className="size-3.5 text-accent" />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-left">
              Working Table
              {set && sources.length ? (
                <span className="font-normal text-ink-muted">
                  {" "}
                  · {sources.length} {sources.length === 1 ? "source" : "sources"}
                  {inUse ? ` · ${inUse} in use` : ""}
                </span>
              ) : null}
              {showNudge && isCarousel ? (
                <span className="font-normal text-accent-ink">
                  {" "}
                  · <Sparkles className="inline size-3.5 align-[-2px]" aria-hidden /> {nudge!.count} unused
                </span>
              ) : null}
              {responses?.fresh ? (
                <span className="font-normal text-accent-ink">
                  {" "}
                  · {responses.fresh} new {responses.fresh === 1 ? "reply" : "replies"}
                </span>
              ) : null}
            </span>
            <ChevronUp className="size-4 shrink-0 text-ink-subtle" aria-hidden />
          </span>
        </button>
      </div>

      {/* Sheets */}
      <WorkingTable
        open={sheet === "table" || sheet === "table-available" || sheet === "table-external"}
        onOpenChange={(o) => !o && setSheet(null)}
        initialTab={sheet === "table-external" ? "external" : sheet === "table-available" || (sources.length > 0 && !inUse) ? "available" : "in_use"}
        set={set}
        artifactId={artifact.id}
        creationTitle={title || artifact.title}
        creationType={artifact.type}
        slideId={slides.current}
        onAction={async (row, a) => {
          // Collapsed after use (board): the canvas shows what happened.
          setSheet(null);
          await runAction(row, a);
        }}
        onUsePart={(row) => setFragmentsFor(row)}
        onManage={() => setSheet("set")}
        onBringIn={() => setSheet("bring")}
        onExternalAdded={(r) => void externalAdded(r)}
        responses={responses}
        onResponses={() => setSheet("responses")}
        onDejaVu={() => setSheet("dejavu")}
      />
      <DejaVuIntakeSheet
        open={sheet === "dejavu"}
        onOpenChange={(o) => !o && setSheet(null)}
        sessionId={set?.sessionId ?? null}
        dejavuId={set?.dejavu?.id ?? null}
        onAdded={(next) => {
          setSet(next);
          setSheet("table-available");
        }}
      />
      <CommunityResponsesSheet
        open={sheet === "responses"}
        onOpenChange={(o) => !o && setSheet(null)}
        sessionId={set?.sessionId ?? null}
        data={responses}
        onChanged={() => setRespKey((k) => k + 1)}
        onSet={setSet}
      />
      <AskCommunitySheet open={sheet === "ask"} onOpenChange={(o) => !o && setSheet(null)} artifactId={artifact.id} fragment={askFragment} onAsked={() => setRespKey((k) => k + 1)} />
      <WorkingSetSheet
        open={sheet === "set" || sheet === "influence"}
        onOpenChange={(o) => !o && setSheet(null)}
        set={set}
        onChange={change}
        onSet={setSet}
        initialFilter={sheet === "influence" ? "in_use" : "all"}
        onBringIn={() => setSheet("bring")}
        onFragments={(row) => setFragmentsFor(row)}
        onUsed={(rows) => void applyUses(rows)}
      />
      <BringInSheet
        open={sheet === "bring"}
        onOpenChange={(o) => !o && setSheet(null)}
        sessionId={set?.sessionId ?? null}
        onAdded={(next) => {
          setSet(next);
          setSheet("table-available");
        }}
        onExternal={() => setSheet("table-external")}
      />
      <ChangeFormatSheet open={sheet === "format"} onOpenChange={(o) => !o && setSheet(null)} sessionId={set?.sessionId ?? null} currentType={artifact.type} aiLive={!offline} />
      {fragmentsFor && set ? <FragmentsSheet sessionId={set.sessionId} row={fragmentsFor} onClose={() => setFragmentsFor(null)} onAdded={(next) => setSet(next)} /> : null}
      <Dialog open={sheet === "more"} onOpenChange={(o) => !o && setSheet(null)}>
        <DialogContent title="Save, version and publish" description="Keep experimenting; save when ready." art={KIT.mark.starGold}>
          <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
            {(audioPage
              ? [
                  ...(take?.url
                    ? [{ label: take.mix ? "Download the mix" : "Download the recording", hint: take.mix ? "Your take with its music, as a WAV" : "The take as recorded", act: () => { const a = document.createElement("a"); a.href = take.mix?.url ?? take.url!; a.download = ""; a.click(); setSheet(null); } }]
                    : []),
                  // A Room's song (creative-room-parts.md, step 5b): every part together, credited as agreed, published from Listen together.
                  ...(part ? [{ label: "Publish the whole song", hint: `Every part of ${part.project.title} together, once the credits are agreed`, act: () => router.push(`/rooms/${part.project.id}/song`) }] : []),
                  { label: "Save version", hint: `v${(base?.number ?? 0) + 1} – ${artifact.typeLabel} (${title || "Untitled"})`, act: () => setSheet("save") },
                  { label: "Export", hint: "The words as Markdown, text or a web page", act: () => setSheet("export") },
                  { label: "Share privately", hint: "Only people with the link", act: () => router.push(`/creations/${artifact.id}/share`) },
                  { label: "Versions", hint: `v${base?.number ?? 1} is current — every take is a version`, act: () => router.push(`/creations/${artifact.id}?tab=versions`) },
                  { label: "Make a carousel", hint: "Turn the words into slides — the recording stays here", act: () => setSheet("format") },
                  { label: "What's influencing this?", hint: workingSetSummary(sources), act: () => setSheet("influence") },
                  { label: "Rights", hint: "Who may use it, and how", act: () => router.push(`/creations/${artifact.id}?tab=rights`) },
                  ...suggestRows,
                ]
              : videoPage
              ? [
                  { label: "Render video", hint: "Make a draft video from the storyboard — when a video provider is connected", act: () => askVideo("render") },
                  { label: "Export", hint: "The shot list as Markdown, text or a web page", act: () => setSheet("export") },
                  ...(hasShots ? [{ label: "Publish as link", hint: "Its own page — the shot list, your name", act: () => setSheet("publish") }] : []),
                  { label: "Share privately", hint: "Only people with the link", act: () => router.push(`/creations/${artifact.id}/share`) },
                  { label: "Versions", hint: `v${base?.number ?? 1} is current — every change is a version`, act: () => router.push(`/creations/${artifact.id}?tab=versions`) },
                  { label: "What's influencing this?", hint: workingSetSummary(sources), act: () => setSheet("influence") },
                  { label: "Rights", hint: "Who may use it, and how", act: () => router.push(`/creations/${artifact.id}?tab=rights`) },
                  ...suggestRows,
                ]
              : deckPage
              ? [
                  { label: "Theme", hint: "Editorial Paper, Cinematic Dark or Soft Gradient", act: () => askDeck("theme") },
                  ...(hasSlides ? [{ label: "Print or save as PDF", hint: "Every slide on its own landscape page", act: () => askDeck("print") }] : []),
                  ...(hasSlides ? [{ label: "Publish as link", hint: "Its own page — the slides' words, your name", act: () => setSheet("publish") }] : []),
                  { label: "Share privately", hint: "Only people with the link", act: () => router.push(`/creations/${artifact.id}/share`) },
                  { label: "Versions", hint: `v${base?.number ?? 1} is current — every change is a version`, act: () => router.push(`/creations/${artifact.id}?tab=versions`) },
                  { label: "Make a carousel", hint: "Turn the slides into a carousel — the deck stays here", act: () => setSheet("format") },
                  { label: "What's influencing this?", hint: workingSetSummary(sources), act: () => setSheet("influence") },
                  { label: "Rights", hint: "Who may use it, and how", act: () => router.push(`/creations/${artifact.id}?tab=rights`) },
                  ...suggestRows,
                ]
              : imagesPage
              ? [
                  { label: "Add a picture", hint: "Take one, choose one of yours, or let CreativeMind make one", act: () => askImages("add") },
                  ...(hasPictures ? [{ label: "Arrange & captions", hint: "The order, and a line under each — a photo essay", act: () => askImages("arrange") }] : []),
                  ...(hasPictures ? [{ label: "Publish as link", hint: "Its own page — the pictures as you've shaped them, your name", act: () => setSheet("publish") }] : []),
                  { label: "Make a carousel", hint: "Turn these into slides — the pictures stay here too", act: () => setSheet("format") },
                  { label: "Share privately", hint: "Only people with the link", act: () => router.push(`/creations/${artifact.id}/share`) },
                  { label: "Versions", hint: `v${base?.number ?? 1} is current — every Keep is a version`, act: () => router.push(`/creations/${artifact.id}?tab=versions`) },
                  { label: "What's influencing this?", hint: workingSetSummary(sources), act: () => setSheet("influence") },
                  { label: "Rights", hint: "Who may use it, and how", act: () => router.push(`/creations/${artifact.id}?tab=rights`) },
                  ...suggestRows,
                ]
              : writing
              ? [
                  { label: "Read it on its own", hint: "Just the words, full screen", act: () => router.push(`/creations/${artifact.id}/read`) },
                  { label: "Publish as link", hint: "Its own page — the cover, the paper, your name", act: () => setSheet("publish") },
                  { label: "Refine with CreativeMind", hint: "Improve, shorten, or a quality review", act: () => setSheet("refine") },
                  { label: "Export", hint: artifact.format === "screenplay" ? "Fountain, text, Markdown or a web page" : "Markdown, text or a web page", act: () => setSheet("export") },
                  { label: "Share privately", hint: "Only people with the link", act: () => router.push(`/creations/${artifact.id}/share`) },
                  { label: "Save version", hint: `v${(base?.number ?? 0) + 1} – ${artifact.typeLabel} (${title || "Untitled"})`, act: () => setSheet("save") },
                  { label: "Versions", hint: `v${base?.number ?? 1} is current`, act: () => router.push(`/creations/${artifact.id}?tab=versions`) },
                  { label: "What's influencing this?", hint: workingSetSummary(sources), act: () => setSheet("influence") },
                  ...(askFragment && askOn ? [{ label: "Ask Pulse", hint: `About ${askFragment.label.toLowerCase()} — only that part is shared`, act: () => setSheet("ask") }] : []),
                  { label: "Change format", hint: "Make a carousel, video, etc. from it", act: () => setSheet("format") },
                  { label: "Rights", hint: "Who may use it, and how", act: () => router.push(`/creations/${artifact.id}?tab=rights`) },
                  ...suggestRows,
                ]
              : [
              ...(!isCarousel
                ? [
                    { label: "Read it on its own", hint: "Just the words, full screen", act: () => router.push(`/creations/${artifact.id}/read`) },
                    { label: "Refine with CreativeMind", hint: "Improve, shorten, or a quality review", act: () => setSheet("refine") },
                  ]
                : []),
              ...(!isCarousel ? [{ label: "Save version", hint: `v${(base?.number ?? 0) + 1} – ${artifact.typeLabel} (${title || "Untitled"})`, act: () => setSheet("save") }] : []),
              ...(isCarousel
                ? [
                    {
                      label: "Arrange slides",
                      hint: "Reorder without regenerating",
                      act: () => {
                        setSheet(null);
                        setArrangeReq((x) => x + 1);
                      },
                    },
                  ]
                : []),
              { label: "What's influencing this?", hint: workingSetSummary(sources), act: () => setSheet("influence") },
              ...(askFragment && askOn ? [{ label: "Ask Pulse", hint: `About ${askFragment.label.toLowerCase()} — only that part is shared`, act: () => setSheet("ask") }] : []),
              { label: "View version history", hint: `v${base?.number ?? 1} is current`, act: () => router.push(`/creations/${artifact.id}?tab=versions`) },
              { label: "Transform / Derive", hint: "Make a carousel, video, etc.", act: () => setSheet("format") },
              { label: "Share (private link)", hint: "Only people with the link", act: () => router.push(`/creations/${artifact.id}/share`) },
              { label: "Publish", hint: "To profile, social, webhook", act: () => router.push(`/creations/${artifact.id}/publish`) },
              { label: "Rights & license", hint: "Set commercial rights", act: () => router.push(`/creations/${artifact.id}?tab=rights`) },
            ]).map((row) => (
              <li key={row.label}>
                <button type="button" onClick={row.act} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-black/[0.02]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{row.label}</span>
                    <span className="block truncate text-[12px] text-ink-subtle">{row.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      {imagesPage || deckPage || videoPage ? <PublishLinkSheet open={sheet === "publish"} onOpenChange={(o) => !o && setSheet(null)} artifactId={artifact.id} unsaved={false} onSaveFirst={() => setSheet(null)} /> : null}
      {/* The Audio page publishes the take (or the take with its music) — this sheet was never mounted here before. */}
      {audioPage ? <PublishLinkSheet open={sheet === "publish"} onOpenChange={(o) => !o && setSheet(null)} artifactId={artifact.id} unsaved={dirty} onSaveFirst={() => setSheet("save")} /> : null}
      {/* Export on the Audio and Video pages (the Writing page has its own, below). */}
      {audioPage || videoPage ? <ExportSheet open={sheet === "export"} onOpenChange={(o) => !o && setSheet(null)} artifactId={artifact.id} type={artifact.type} unsaved={false} /> : null}
      {part ? (
        <>
          {partSheet?.kind === "changes" ? <PartChangesSheet key={partSheet.other.partId} open projectId={part.project.id} other={partSheet.other} onOpenChange={(o) => !o && setPartSheet(null)} /> : null}
          {partSheet?.kind === "suggest" ? <SuggestSheet key={partSheet.other.partId} open projectId={part.project.id} other={partSheet.other} onOpenChange={(o) => !o && setPartSheet(null)} /> : null}
        </>
      ) : null}
      {writing ? (
        <>
          <CoverSheet open={sheet === "cover"} onOpenChange={(o) => !o && setSheet(null)} artifactId={artifact.id} coverUrl={artifact.coverUrl} look={look} onLook={(l) => void chooseLook(l)} ornament={ornament ?? "keystone"} onOrnament={(o) => void chooseOrnament(o)} onCover={chooseCover} />
          <PublishLinkSheet open={sheet === "publish"} onOpenChange={(o) => !o && setSheet(null)} artifactId={artifact.id} unsaved={dirty} onSaveFirst={() => setSheet("save")} />
          <CraftSheet open={sheet === "craft"} onOpenChange={(o) => !o && setSheet(null)} style={style} title={title} text={content} />
          <AloudSheet open={sheet === "aloud"} onOpenChange={(o) => !o && setSheet(null)} title={title} text={content} verse={verse} />
          <KindSheet open={sheet === "kind"} onOpenChange={(o) => !o && setSheet(null)} current={artifact.type} busy={kindBusy} onChoose={(t) => void chooseKind(t)} />
          <ExportSheet open={sheet === "export"} onOpenChange={(o) => !o && setSheet(null)} artifactId={artifact.id} type={artifact.type} unsaved={dirty} />
        </>
      ) : null}
      <SaveVersionSheet
        open={sheet === "save"}
        onOpenChange={(o) => !o && setSheet(null)}
        defaultName={`${artifact.typeLabel} (${title || "Untitled"})`}
        inUse={inUse}
        unused={sources.length - inUse}
        busy={working === "version"}
        onSave={saveVersion}
      />
    </div>
  );
}

/** How long a part's words rest before they are saved as a version for the crew. */
const IDLE_VERSION_MS = 30_000;
const MODE_ICON: Record<string, keyof typeof KIT.iconChip> = { writing: "type", carousel: "layers", image: "image", video: "video", audio: "waveform", presentation: "file" };

/** "Save as new version" (board §12): the one checkpoint that turns the draft into a durable version. */
function SaveVersionSheet({
  open,
  onOpenChange,
  defaultName,
  inUse,
  unused,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultName: string;
  inUse: number;
  unused: number;
  busy: boolean;
  onSave: (o: { name: string; keepUnused: boolean }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Save as new version" description="A durable checkpoint. Everything you keep experimenting with stays in the Studio." art={KIT.mark.starGold}>
        {open ? <SaveVersionBody defaultName={defaultName} inUse={inUse} unused={unused} busy={busy} onSave={onSave} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SaveVersionBody({
  defaultName,
  inUse,
  unused,
  busy,
  onSave,
  onClose,
}: {
  defaultName: string;
  inUse: number;
  unused: number;
  busy: boolean;
  onSave: (o: { name: string; keepUnused: boolean }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [keepUnused, setKeepUnused] = useState(true);
  return (
    <div className="space-y-3">
      <label className="block text-sm text-ink">
        Version name
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="mt-1" />
      </label>
      <p className="text-[13px] text-ink-muted">{inUse ? `Saved with ${inUse} ${inUse === 1 ? "source" : "sources"} in use.` : "No sources are in use yet."}</p>
      {unused ? (
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-ink">
          Keep {unused} unused {unused === 1 ? "source" : "sources"} for later
          <Switch checked={keepUnused} onCheckedChange={setKeepUnused} label="Keep unused sources for later" />
        </label>
      ) : null}
      <Button className="w-full" loading={busy} onClick={() => onSave({ name, keepUnused })}>
        Save version
      </Button>
      <button type="button" onClick={onClose} className={buttonClasses({ variant: "ghost", className: "w-full" })}>
        Continue in Studio
      </button>
    </div>
  );
}
