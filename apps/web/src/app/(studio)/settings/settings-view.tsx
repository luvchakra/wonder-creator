"use client";
import { AUTONOMY_DOMAINS, AUTONOMY_LEVELS, type AutonomyDomain, type AutonomyLevel } from "@wonder/creator-identity/autonomy";
import { CONTACT_PREFERENCES, EXCLUSIVITY, RATE_VISIBILITY, WORK_MODES } from "@wonder/creator-identity/collaboration-options";
import { DISCIPLINES, EXPERIMENTATION, FORMALITY, LANGUAGES, SUGGESTED_AVOID, SUGGESTED_PRESERVE, TONES, VISUAL_STYLES, WRITING_STYLES } from "@wonder/creator-identity/vocabulary";
import { Avatar, Badge, Button, ChoiceChip, ConfirmDialog, Dialog, DialogContent, Field, Input, Select, Switch, TagInput, Textarea, buttonClasses, cn } from "@wonder/ui";
import { BadgeCheck, Brain, Download, Handshake, KeyRound, Palette, Plug, Shield, SlidersHorizontal, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TESTIMONIALS_FROM, TESTIMONIALS_FROM_HINT, TESTIMONIALS_FROM_LABEL, type TestimonialsFrom } from "@wonder/creator-identity/testimonials-options";
import { api, errorMessage } from "@/lib/client";
import { OpenToEditor } from "@/components/community/open-to";
import { PrivacyPanel } from "./privacy-panel";
import { SecurityPanel } from "./security-panel";

const SECTIONS = [
  { key: "profile", label: "Account & Profile", icon: UserRound },
  { key: "identity", label: "Creative Identity", icon: Palette },
  { key: "preferences", label: "Creative Preferences", icon: SlidersHorizontal },
  { key: "collaboration", label: "Collaboration", icon: Handshake },
  { key: "brand", label: "Brand work", icon: BadgeCheck },
  { key: "autonomy", label: "AI & CreativeMind", icon: Sparkles },
  { key: "privacy", label: "Privacy & Security", icon: Shield },
];

// Compact section chips: a 32px pill inside a 44px hit target; full-width rows on desktop.
const NAV_ITEM = "flex min-h-11 shrink-0 items-center text-left text-sm lg:w-full";
const NAV_PILL = "flex h-8 items-center gap-2 rounded-full px-3 lg:h-9 lg:w-full lg:rounded-xl";

const toggle = (list: string[], v: string, max = 12) => (list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v]);

type Props = {
  section: string;
  email: string;
  avatarUrl: string | null;
  profile: { displayName: string; handle: string; bio: string; location: string; showLocation: boolean; visibility: string; collaborationAvailability: "open" | "selective" | "closed"; languages: string[] };
  identity: { disciplines: string[]; skills: string[]; interests: string[] };
  voice: { tones: string[]; writingStyle: string | null; formality: string | null; visualStyles: string[]; recurringThemes: string[]; narrativeStyle: string; vocabulary: string; codeSwitching: boolean; experimentation: "stay_close" | "balanced" | "experiment" };
  boundaries: { preserve: string[]; avoid: string[]; sensitive: string[] };
  autonomy: Record<AutonomyDomain, AutonomyLevel>;
  brand: {
    openToBrands: boolean;
    niches: string[];
    industries: string[];
    regions: string[];
    expertise: string[];
    platforms: string[];
    deliverables: string[];
    priorCollaborations: string[];
    turnaround: string | null;
    commercialBoundaries: string | null;
    exclusivity: string | null;
    usageRights: string | null;
  };
  collaboration: {
    projectTypes: string[];
    interests: string[];
    workMode: "either" | "remote" | "local";
    region: string | null;
    turnaround: string | null;
    contactPreference: "anyone" | "network";
    commercialBoundaries: string | null;
    rateGuidance: string | null;
    rateVisibility: "private" | "collaborators" | "public";
    rightsPreferences: string | null;
    exclusivity: "open" | "case_by_case" | "non_exclusive_only";
  };
  blocked: Array<{ id: string; name: string; handle: string | null }>;
  readiness: { ai: { provider: string; live: boolean; note: string }; mediaConfigured: boolean; payments: { stripe: boolean; razorpay: boolean; any: boolean } };
};

export function SettingsView(props: Props) {
  const [section, setSection] = useState(SECTIONS.some((s) => s.key === props.section) ? props.section : "profile");
  return (
    <div className="grid gap-3 [&>*]:min-w-0 lg:grid-cols-[220px_1fr] lg:gap-6">
      <nav aria-label="Settings sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:block lg:space-y-0.5 lg:px-0">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            aria-current={section === s.key ? "page" : undefined}
            ref={section === s.key ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined}
            className={cn(NAV_ITEM, section === s.key ? "font-medium text-accent-ink [&>span]:bg-accent-soft" : "text-ink-muted [&>span]:hover:bg-black/[0.04]")}
          >
            <span className={NAV_PILL}>
              <s.icon className="size-4" aria-hidden /> {s.label}
            </span>
          </button>
        ))}
        <Link href="/memory" className={cn(NAV_ITEM, "text-ink-muted [&>span]:hover:bg-black/[0.04]")}>
          <span className={NAV_PILL}>
            <Brain className="size-4" aria-hidden /> Creative Memory
          </span>
        </Link>
        <Link href="/settings/ai" className={cn(NAV_ITEM, "text-ink-muted [&>span]:hover:bg-black/[0.04]")}>
          <span className={NAV_PILL}>
            <KeyRound className="size-4" aria-hidden /> AI Providers
          </span>
        </Link>
        <Link href="/publishing" className={cn(NAV_ITEM, "text-ink-muted [&>span]:hover:bg-black/[0.04]")}>
          <span className={NAV_PILL}>
            <Plug className="size-4" aria-hidden /> Connected apps
          </span>
        </Link>
      </nav>
      <div className="min-w-0 rounded-2xl border border-border-soft bg-surface p-3.5 sm:p-5">
        {section === "profile" ? <ProfileSection {...props} /> : null}
        {section === "identity" ? <IdentitySection {...props} /> : null}
        {section === "preferences" ? <PreferencesSection {...props} /> : null}
        {section === "collaboration" ? <CollaborationSection {...props} /> : null}
        {section === "brand" ? <BrandSection {...props} /> : null}
        {section === "autonomy" ? <AutonomySection {...props} /> : null}
        {section === "privacy" ? <PrivacySection {...props} /> : null}
      </div>
    </div>
  );
}

function useSaver() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (fn: () => Promise<unknown>, ok = "Saved.") => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const status = msg ? (
    <p role={msg.ok ? "status" : "alert"} className={cn("text-sm", msg.ok ? "text-success-ink" : "text-danger")}>
      {msg.text}
    </p>
  ) : null;
  return { busy, save, status };
}

function ProfileSection({ profile, avatarUrl, email }: Props) {
  const [p, setP] = useState(profile);
  const { busy, save, status } = useSaver();
  const avatar = useSaver();
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save(async () => {
          await api("/api/v1/creators/me", { method: "PATCH", json: { displayName: p.displayName, handle: p.handle, bio: p.bio, location: p.location, showLocation: p.showLocation, visibility: p.visibility, collaborationAvailability: p.collaborationAvailability } });
          await api("/api/v1/creators/me/about", { method: "PUT", json: { displayName: p.displayName, handle: p.handle, bio: p.bio, location: p.location, showLocation: p.showLocation, languages: p.languages } });
        });
      }}
    >
      <h2 className="text-base font-semibold text-ink">Account & Profile</h2>
      <div className="flex items-center gap-4">
        <Avatar name={p.displayName || "You"} src={avatarUrl} size={56} />
        <div>
          <label className={buttonClasses({ variant: "secondary", size: "sm", className: "cursor-pointer" })}>
            Change photo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.append("file", f);
                void avatar.save(() => api("/api/v1/creators/avatar", { method: "POST", body: fd }), "Photo updated.");
              }}
            />
          </label>
          <div className="mt-1">{avatar.status}</div>
        </div>
      </div>
      <p className="text-sm text-ink-muted">Signed in as {email}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="s-name">
          <Input id="s-name" value={p.displayName} onChange={(e) => setP({ ...p, displayName: e.target.value })} maxLength={80} />
        </Field>
        <Field label="Handle" htmlFor="s-handle">
          <Input id="s-handle" value={p.handle} onChange={(e) => setP({ ...p, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} maxLength={30} />
        </Field>
        <Field label="Short description" htmlFor="s-bio" className="sm:col-span-2" counter={`${p.bio.length}/300`}>
          <Textarea id="s-bio" value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value.slice(0, 300) })} />
        </Field>
        <Field label="Location" htmlFor="s-loc">
          <Input id="s-loc" value={p.location} onChange={(e) => setP({ ...p, location: e.target.value })} maxLength={120} />
        </Field>
        <label className="flex items-end justify-between gap-3 pb-2 text-sm text-ink">
          Show location on profile
          <Switch checked={p.showLocation} onCheckedChange={(v) => setP({ ...p, showLocation: v })} label="Show location on profile" />
        </label>
        <Field label="Collaboration" htmlFor="s-collab">
          <Select id="s-collab" value={p.collaborationAvailability} onChange={(e) => setP({ ...p, collaborationAvailability: e.target.value as "open" })}>
            <option value="open">Open to collaborate</option>
            <option value="selective">Selectively collaborating</option>
            <option value="closed">Not collaborating right now</option>
          </Select>
        </Field>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Languages you create in</p>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...LANGUAGES.slice(0, 12), ...p.languages])].map((l) => (
            <ChoiceChip key={l} selected={p.languages.includes(l)} onToggle={() => setP({ ...p, languages: toggle(p.languages, l, 10) })}>
              {l}
            </ChoiceChip>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={busy}>
          Save profile
        </Button>
        {status}
      </div>
    </form>
  );
}

function IdentitySection({ identity }: Props) {
  const [s, setS] = useState(identity);
  const { busy, save, status } = useSaver();
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-ink">Creative Identity</h2>
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Creative disciplines</p>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...DISCIPLINES, ...s.disciplines])].map((d) => (
            <ChoiceChip key={d} selected={s.disciplines.includes(d)} onToggle={() => setS({ ...s, disciplines: toggle(s.disciplines, d) })}>
              {d}
            </ChoiceChip>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Skills" htmlFor="id-skills">
          <TagInput id="id-skills" value={s.skills} onChange={(v) => setS({ ...s, skills: v })} max={20} />
        </Field>
        <Field label="Interests" htmlFor="id-int">
          <TagInput id="id-int" value={s.interests} onChange={(v) => setS({ ...s, interests: v })} max={20} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button loading={busy} disabled={!s.disciplines.length} onClick={() => save(() => api("/api/v1/creators/me/identity", { method: "PUT", json: s }))}>
          Save
        </Button>
        {status}
      </div>
    </div>
  );
}

function PreferencesSection({ voice, boundaries }: Props) {
  const [v, setV] = useState(voice);
  const [b, setB] = useState(boundaries);
  const { busy, save, status } = useSaver();
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-ink">Creative Preferences</h2>
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Tone</p>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <ChoiceChip key={t} selected={v.tones.includes(t)} onToggle={() => setV({ ...v, tones: toggle(v.tones, t, 6) })}>
              {t}
            </ChoiceChip>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Writing style</p>
          <div className="flex flex-wrap gap-2">
            {WRITING_STYLES.map((w) => (
              <ChoiceChip key={w.value} selected={v.writingStyle === w.value} onToggle={() => setV({ ...v, writingStyle: v.writingStyle === w.value ? null : w.value })}>
                {w.label}
              </ChoiceChip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Formality</p>
          <div className="flex flex-wrap gap-2">
            {FORMALITY.map((f) => (
              <ChoiceChip key={f.value} selected={v.formality === f.value} onToggle={() => setV({ ...v, formality: v.formality === f.value ? null : f.value })}>
                {f.label}
              </ChoiceChip>
            ))}
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Visual style</p>
        <div className="flex flex-wrap gap-2">
          {VISUAL_STYLES.map((s) => (
            <ChoiceChip key={s} selected={v.visualStyles.includes(s)} onToggle={() => setV({ ...v, visualStyles: toggle(v.visualStyles, s, 6) })}>
              {s}
            </ChoiceChip>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Recurring themes" htmlFor="p-themes">
          <TagInput id="p-themes" value={v.recurringThemes} onChange={(x) => setV({ ...v, recurringThemes: x })} placeholder="Memory, family, home…" />
        </Field>
        <Field label="Narrative style" htmlFor="p-narr">
          <Input id="p-narr" value={v.narrativeStyle} onChange={(e) => setV({ ...v, narrativeStyle: e.target.value })} placeholder="First person, present tense…" />
        </Field>
        <Field label="Vocabulary & language style" htmlFor="p-vocab">
          <Input id="p-vocab" value={v.vocabulary} onChange={(e) => setV({ ...v, vocabulary: e.target.value })} placeholder="Simple words, Hindi phrases…" />
        </Field>
        <label className="flex items-end justify-between gap-3 pb-2 text-sm text-ink">
          I mix languages (code-switching)
          <Switch checked={v.codeSwitching} onCheckedChange={(x) => setV({ ...v, codeSwitching: x })} label="I mix languages" />
        </label>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Experimentation</p>
        <div className="flex flex-wrap gap-2">
          {EXPERIMENTATION.map((x) => (
            <ChoiceChip key={x.value} selected={v.experimentation === x.value} onToggle={() => setV({ ...v, experimentation: x.value })}>
              {x.label}
            </ChoiceChip>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Things to preserve" htmlFor="p-pres">
          <TagInput id="p-pres" value={b.preserve} onChange={(x) => setB({ ...b, preserve: x })} suggestions={SUGGESTED_PRESERVE} />
        </Field>
        <Field label="Things to avoid" htmlFor="p-avoid">
          <TagInput id="p-avoid" value={b.avoid} onChange={(x) => setB({ ...b, avoid: x })} suggestions={SUGGESTED_AVOID} />
        </Field>
        <Field label="Handle with care" htmlFor="p-sens" className="sm:col-span-2">
          <TagInput id="p-sens" value={b.sensitive} onChange={(x) => setB({ ...b, sensitive: x })} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button
          loading={busy}
          onClick={() =>
            save(async () => {
              await api("/api/v1/creators/me/style", { method: "PUT", json: v });
              await api("/api/v1/creators/me/boundaries", { method: "PUT", json: b });
            })
          }
        >
          Save preferences
        </Button>
        {status}
      </div>
    </div>
  );
}

const CAPPED: AutonomyDomain[] = ["rights", "commerce", "destructive_actions"];

function AutonomySection({ autonomy }: Props) {
  const [a, setA] = useState(autonomy);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">AI & CreativeMind</h2>
          <p className="mt-1 text-[15px] text-ink-muted">Choose how CreativeMind can work with you. Be bold with creativity; be conservative with consequences.</p>
          <Link href="/approvals" className="mt-1 inline-flex min-h-11 items-center text-[15px] font-medium text-accent-ink hover:underline">
            Review approvals
          </Link>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              setA(await api("/api/v1/creators/autonomy", { method: "PATCH", json: { reset: true } }));
              router.refresh();
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          Reset to defaults
        </Button>
      </div>
      <ul className="mt-5 divide-y divide-border-soft">
        {AUTONOMY_DOMAINS.map((d) => (
          <li key={d.domain} className="grid gap-2 py-3 sm:grid-cols-[1fr_220px] sm:items-center">
            <div>
              <p className="font-medium text-ink">{d.label}</p>
              <p className="text-sm text-ink-muted">{d.description}</p>
            </div>
            <div>
              <label htmlFor={`aut-${d.domain}`} className="sr-only">
                {d.label} autonomy
              </label>
              <Select
                id={`aut-${d.domain}`}
                value={a[d.domain]}
                disabled={saving === d.domain}
                onChange={async (e) => {
                  const level = e.target.value as AutonomyLevel;
                  const prev = a[d.domain];
                  setA({ ...a, [d.domain]: level });
                  setSaving(d.domain);
                  setError(null);
                  try {
                    await api("/api/v1/creators/autonomy", { method: "PATCH", json: { domain: d.domain, level } });
                  } catch (err) {
                    setA((x) => ({ ...x, [d.domain]: prev }));
                    setError(errorMessage(err));
                  } finally {
                    setSaving(null);
                  }
                }}
              >
                {AUTONOMY_LEVELS.filter((l) => !(CAPPED.includes(d.domain) && l.level === "auto_execute")).map((l) => (
                  <option key={l.level} value={l.level}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <p className="mt-4 text-sm text-ink-subtle">Rights, commerce and destructive actions can never run automatically — at most, CreativeMind asks for your approval. Imported material can never change these settings.</p>
    </div>
  );
}

function PrivacySection({ profile, blocked, readiness, email }: Props) {
  const [visibility, setVisibility] = useState(profile.visibility);
  const { busy, save, status } = useSaver();
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-ink">Privacy & Security</h2>
      <p className="text-[13px] text-ink-muted">You own your materials and Creations. They&apos;re private unless you share them, and CreativeMind works only on what you choose.</p>
      <SecurityPanel email={email ?? null} />
      <fieldset>
        <legend className="text-sm font-medium text-ink">Profile visibility</legend>
        <div className="mt-1.5 divide-y divide-border-soft rounded-xl border border-border-soft">
          {[
            ["public", "Public", "Anyone can see your profile and public work."],
            ["creators_only", "Creators only", "Signed-in creators can see your profile."],
            ["private", "Private (only me)", "Your profile is hidden; your Huddle presence shows no name."],
          ].map(([v, label, hint]) => (
            <label key={v} className="flex min-h-11 cursor-pointer items-start gap-3 px-3 py-2 first:rounded-t-xl last:rounded-b-xl has-[:checked]:bg-accent-softer">
              <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]" />
              <span className="min-w-0">
                <span className="block text-sm text-ink">{label}</span>
                <span className="text-[13px] text-ink-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        {visibility !== profile.visibility || status ? (
          <div className="mt-2 flex items-center gap-3">
            <Button size="sm" loading={busy} onClick={() => save(() => api("/api/v1/creators/me", { method: "PATCH", json: { displayName: profile.displayName, handle: profile.handle, bio: profile.bio, location: profile.location, showLocation: profile.showLocation, collaborationAvailability: profile.collaborationAvailability, visibility } }))}>
              Save visibility
            </Button>
            {status}
          </div>
        ) : null}
      </fieldset>

      <TestimonialsSetting />

      <section>
        <h3 className="text-sm font-medium text-ink">Account</h3>
        <ul className="mt-1.5 divide-y divide-border-soft rounded-xl border border-border-soft text-sm">
          <li>
            <Link href="/settings/audit" className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 hover:bg-black/[0.02]">
              <span className="min-w-0">
                <span className="block text-ink">Security & activity</span>
                <span className="text-[13px] text-ink-muted">Sign-ins, sharing, publishing, approvals and other changes.</span>
              </span>
              <span aria-hidden className="text-ink-muted">›</span>
            </Link>
          </li>
          <li className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
            <span className="text-ink">CreativeMind (AI)</span>
            <Badge tone={readiness.ai.live ? "success" : "warning"}>{readiness.ai.live ? "Connected" : readiness.ai.provider === "offline" ? "Offline development model" : "Not connected"}</Badge>
          </li>
          <li className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
            <span className="text-ink">Huddle voice & video</span>
            <Badge tone={readiness.mediaConfigured ? "success" : "neutral"}>{readiness.mediaConfigured ? "Connected" : "Not connected (text chat only)"}</Badge>
          </li>
          <li className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
            <span className="text-ink">Licence payments</span>
            <Badge tone={readiness.payments.any ? "success" : "neutral"}>
              {readiness.payments.any ? [readiness.payments.razorpay && "Razorpay", readiness.payments.stripe && "Stripe"].filter(Boolean).join(" · ") : "Not connected"}
            </Badge>
          </li>
          <li>
            <a href="/api/v1/account/export" className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 hover:bg-black/[0.02]">
              <span className="min-w-0">
                <span className="block text-ink">Export my data</span>
                <span className="text-[13px] text-ink-muted">Everything we hold about you, as one machine-readable file.</span>
              </span>
              <Download className="size-4 shrink-0 text-ink-muted" aria-hidden />
            </a>
          </li>
        </ul>
        <p className="mt-1.5 text-xs text-ink-subtle">Your material is never used to train AI models. Imported content is treated as data and can never change your settings.</p>
      </section>

      <PrivacyPanel />

      <section>
        <h3 className="text-sm font-medium text-ink">Blocked creators</h3>
        {blocked.length ? (
          <ul className="mt-1.5 divide-y divide-border-soft rounded-xl border border-border-soft">
            {blocked.map((b) => (
              <BlockedRow key={b.id} b={b} />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[13px] text-ink-muted">You haven&apos;t blocked anyone.</p>
        )}
      </section>

      <section className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-[#f5d0d0] bg-danger-soft/40 px-3 py-2">
        <span className="min-w-0 text-sm">
          <span className="block font-medium text-ink">Delete account</span>
          <span className="text-[13px] text-ink-muted">Permanently delete your account and all your data.</span>
        </span>
        <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
          Delete my account
        </Button>
      </section>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function BlockedRow({ b }: { b: { id: string; name: string; handle: string | null } }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="flex min-h-11 items-center justify-between gap-2 px-3 py-1 text-sm">
      <span>
        {b.name} {b.handle ? <span className="text-ink-subtle">@{b.handle}</span> : null}
      </span>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
        Unblock
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Unblock ${b.name}?`}
        body="They'll be able to see your profile and ask to join your public Huddles again."
        confirmLabel="Unblock"
        onConfirm={async () => {
          await api(`/api/v1/creators/${b.id}/block`, { method: "POST", json: { on: false } }).catch(() => undefined);
          setConfirm(false);
          router.refresh();
        }}
      />
    </li>
  );
}

function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Delete your account" description="This permanently deletes your profile, materials, Creations, memories and conversations. It can't be undone.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api("/api/v1/account/delete", { method: "POST", json: { password, confirm } });
              // Account is gone: full reload so no signed-in state survives.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/sign-up";
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Your password" htmlFor="del-pw" hint="We ask again to make sure it's you.">
            <Input id="del-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label='Type "DELETE" to confirm' htmlFor="del-confirm" error={error}>
            <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={busy} disabled={confirm !== "DELETE" || !password}>
              Delete permanently
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** How you want to collaborate (P1-14). Rates stay private unless you choose otherwise. */
function CollaborationSection({ collaboration, profile }: Props) {
  const [c, setC] = useState(collaboration);
  const { busy, save, status } = useSaver();
  const availability = profile.collaborationAvailability === "open" ? "Open to collaborations" : profile.collaborationAvailability === "selective" ? "Selective" : "Not taking collaborations";
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save(() => api("/api/v1/creators/collaboration", { method: "PUT", json: c }), "Collaboration profile saved.");
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-ink">Collaboration</h2>
        <p className="mt-1 text-[15px] text-ink-muted">
          How you like to work with others. Availability is <span className="font-medium text-ink">{availability}</span> — change it under Account &amp; Profile. Your disciplines and languages come from your profile too.
        </p>
      </div>
      <OpenToEditor />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project types you'd like" htmlFor="co-types" hint="e.g. short film, podcast, photo essay">
          <TagInput id="co-types" value={c.projectTypes} onChange={(v) => setC({ ...c, projectTypes: v })} max={12} />
        </Field>
        <Field label="Collaboration interests" htmlFor="co-interests" hint="What you'd love to make with someone">
          <TagInput id="co-interests" value={c.interests} onChange={(v) => setC({ ...c, interests: v })} max={12} />
        </Field>
        <Field label="Where you work" htmlFor="co-mode">
          <Select id="co-mode" value={c.workMode} onChange={(e) => setC({ ...c, workMode: e.target.value as typeof c.workMode })}>
            {WORK_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Region (optional)" htmlFor="co-region" hint="Only what you're happy to share">
          <Input id="co-region" value={c.region ?? ""} maxLength={120} onChange={(e) => setC({ ...c, region: e.target.value })} />
        </Field>
        <Field label="Typical turnaround (optional)" htmlFor="co-turn" hint="e.g. about two weeks for a short">
          <Input id="co-turn" value={c.turnaround ?? ""} maxLength={120} onChange={(e) => setC({ ...c, turnaround: e.target.value })} />
        </Field>
        <Field label="Exclusivity" htmlFor="co-excl">
          <Select id="co-excl" value={c.exclusivity} onChange={(e) => setC({ ...c, exclusivity: e.target.value as typeof c.exclusivity })}>
            {EXCLUSIVITY.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Who can message or invite you</legend>
        <div className="flex flex-wrap gap-2">
          {CONTACT_PREFERENCES.map((m) => (
            <ChoiceChip key={m.value} selected={c.contactPreference === m.value} onToggle={() => setC({ ...c, contactPreference: m.value })}>
              {m.label}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>
      <Field label="Commercial boundaries (optional)" htmlFor="co-comm" hint="Brands, uses or kinds of work you won't take on">
        <Textarea id="co-comm" value={c.commercialBoundaries ?? ""} maxLength={1000} onChange={(e) => setC({ ...c, commercialBoundaries: e.target.value })} />
      </Field>
      <Field label="Rights preferences (optional)" htmlFor="co-rights" hint="e.g. keeping authorship credit, how you like usage licensed">
        <Textarea id="co-rights" value={c.rightsPreferences ?? ""} maxLength={1000} onChange={(e) => setC({ ...c, rightsPreferences: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rate guidance (optional)" htmlFor="co-rate" hint="A range or a starting point — never required">
          <Input id="co-rate" value={c.rateGuidance ?? ""} maxLength={300} onChange={(e) => setC({ ...c, rateGuidance: e.target.value })} />
        </Field>
        <Field label="Who sees your rate guidance" htmlFor="co-rate-vis" hint={c.rateGuidance ? undefined : "Add rate guidance first — until then nobody sees one."}>
          <Select id="co-rate-vis" value={c.rateGuidance ? c.rateVisibility : "private"} disabled={!c.rateGuidance} onChange={(e) => setC({ ...c, rateVisibility: e.target.value as typeof c.rateVisibility })}>
            {RATE_VISIBILITY.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={busy}>
          Save collaboration profile
        </Button>
        {status}
      </div>
    </form>
  );
}

/** Brand work (P1-15): opt in and describe what you'd make. No marketplace or pricing yet; only a short summary is shown. */
function BrandSection({ brand }: Props) {
  const [b, setB] = useState(brand);
  const { busy, save, status } = useSaver();
  const tags = (key: "niches" | "industries" | "regions" | "expertise" | "platforms" | "deliverables" | "priorCollaborations", label: string, hint: string, max = 12) => (
    <Field label={label} htmlFor={`br-${key}`} hint={hint}>
      <TagInput id={`br-${key}`} value={b[key]} onChange={(v) => setB({ ...b, [key]: v })} max={max} />
    </Field>
  );
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save(() => api("/api/v1/creators/brand", { method: "PUT", json: b }), "Brand-work profile saved.");
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-ink">Brand work</h2>
        <p className="mt-1 text-[15px] text-ink-muted">
          Say whether you&rsquo;re open to working with brands and what you&rsquo;d make. When you&rsquo;re open, your profile shows a short summary (niches, industries, platforms, deliverables); everything else here stays with you. Nothing is priced or sold.
        </p>
      </div>
      <Switch id="br-open" checked={b.openToBrands} onCheckedChange={(v) => setB({ ...b, openToBrands: v })} label="Open to brand work" />
      <div className="grid gap-4 sm:grid-cols-2">
        {tags("niches", "Niches", "e.g. travel, food, slow living")}
        {tags("industries", "Industries", "e.g. hospitality, outdoor gear")}
        {tags("platforms", "Platforms", "Where you publish, e.g. YouTube, Instagram")}
        {tags("deliverables", "Deliverables", "e.g. short film, photo series, reel")}
        {tags("expertise", "Expertise", "What you're known for")}
        {tags("regions", "Regions", "Where you can work")}
      </div>
      {tags("priorCollaborations", "Prior brand collaborations (private)", "Only you see these for now", 20)}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Typical turnaround (optional)" htmlFor="br-turn">
          <Input id="br-turn" value={b.turnaround ?? ""} maxLength={120} onChange={(e) => setB({ ...b, turnaround: e.target.value })} />
        </Field>
        <Field label="Exclusivity constraints (optional)" htmlFor="br-excl">
          <Input id="br-excl" value={b.exclusivity ?? ""} maxLength={500} onChange={(e) => setB({ ...b, exclusivity: e.target.value })} />
        </Field>
      </div>
      <Field label="Commercial boundaries (optional)" htmlFor="br-comm" hint="Brands, products or uses you won't take on">
        <Textarea id="br-comm" value={b.commercialBoundaries ?? ""} maxLength={1000} onChange={(e) => setB({ ...b, commercialBoundaries: e.target.value })} />
      </Field>
      <Field label="Usage-right preferences (optional)" htmlFor="br-usage" hint="e.g. organic social only, 12 months, no paid ads without a new agreement">
        <Textarea id="br-usage" value={b.usageRights ?? ""} maxLength={1000} onChange={(e) => setB({ ...b, usageRights: e.target.value })} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={busy}>
          Save brand-work profile
        </Button>
        {status}
      </div>
    </form>
  );
}

/** Testimonials (docs/testimonials.md): who may write one for you. Each still waits for you to show it. */
function TestimonialsSetting() {
  const [from, setFrom] = useState<TestimonialsFrom | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void api<{ from: TestimonialsFrom }>("/api/v1/testimonials/settings").then((r) => live && setFrom(r.from)).catch(() => live && setFrom("anyone"));
    return () => {
      live = false;
    };
  }, []);
  async function choose(next: TestimonialsFrom) {
    const prev = from;
    setFrom(next);
    try {
      await api("/api/v1/testimonials/settings", { method: "PATCH", json: { from: next } });
      setMsg("Saved.");
    } catch (e) {
      setFrom(prev);
      setMsg(errorMessage(e));
    }
  }
  if (from === null) return null;
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">Testimonials</legend>
      <p className="text-[13px] text-ink-muted">Who may write one about you. Nothing shows on your profile until you choose to show it.</p>
      <div className="mt-1.5 divide-y divide-border-soft rounded-xl border border-border-soft">
        {TESTIMONIALS_FROM.map((v) => (
          <label key={v} className="flex min-h-11 cursor-pointer items-start gap-3 px-3 py-2 first:rounded-t-xl last:rounded-b-xl has-[:checked]:bg-accent-softer">
            <input type="radio" name="testimonials_from" value={v} checked={from === v} onChange={() => void choose(v)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]" />
            <span className="min-w-0">
              <span className="block text-sm text-ink">{TESTIMONIALS_FROM_LABEL[v]}</span>
              <span className="text-[13px] text-ink-muted">{TESTIMONIALS_FROM_HINT[v]}</span>
            </span>
          </label>
        ))}
      </div>
      {msg ? (
        <p role="status" className="mt-1 text-[12.5px] text-ink-muted">
          {msg}
        </p>
      ) : null}
    </fieldset>
  );
}
