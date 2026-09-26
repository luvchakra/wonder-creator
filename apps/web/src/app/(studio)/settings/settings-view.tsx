"use client";
import { AUTONOMY_DOMAINS, AUTONOMY_LEVELS, type AutonomyDomain, type AutonomyLevel } from "@wonder/creator-identity/autonomy";
import { DISCIPLINES, EXPERIMENTATION, FORMALITY, LANGUAGES, SUGGESTED_AVOID, SUGGESTED_PRESERVE, TONES, VISUAL_STYLES, WRITING_STYLES } from "@wonder/creator-identity/vocabulary";
import { Avatar, Badge, Button, ChoiceChip, ConfirmDialog, Dialog, DialogContent, Field, Input, Select, Switch, TagInput, Textarea, buttonClasses, cn } from "@wonder/ui";
import { Brain, Download, Palette, Shield, SlidersHorizontal, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

const SECTIONS = [
  { key: "profile", label: "Account & Profile", icon: UserRound },
  { key: "identity", label: "Creative Identity", icon: Palette },
  { key: "preferences", label: "Creative Preferences", icon: SlidersHorizontal },
  { key: "autonomy", label: "Creator Autonomy", icon: Sparkles },
  { key: "privacy", label: "Privacy & Security", icon: Shield },
];

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
  blocked: Array<{ id: string; name: string; handle: string | null }>;
  readiness: { ai: { provider: string; live: boolean; note: string }; mediaConfigured: boolean };
};

export function SettingsView(props: Props) {
  const [section, setSection] = useState(SECTIONS.some((s) => s.key === props.section) ? props.section : "profile");
  return (
    <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[240px_1fr]">
      <nav aria-label="Settings sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:px-0">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            aria-current={section === s.key ? "page" : undefined}
            className={cn("flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3 text-left text-[15px] lg:w-full", section === s.key ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-muted hover:bg-black/[0.04]")}
          >
            <s.icon className="size-4" aria-hidden /> {s.label}
          </button>
        ))}
        <Link href="/memory" className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3 text-[15px] text-ink-muted hover:bg-black/[0.04]">
          <Brain className="size-4" aria-hidden /> Creative Memory
        </Link>
      </nav>
      <div className="min-w-0 rounded-3xl border border-border-soft bg-surface p-5 sm:p-7">
        {section === "profile" ? <ProfileSection {...props} /> : null}
        {section === "identity" ? <IdentitySection {...props} /> : null}
        {section === "preferences" ? <PreferencesSection {...props} /> : null}
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
      <h2 className="text-xl font-semibold text-ink">Account & Profile</h2>
      <div className="flex items-center gap-4">
        <Avatar name={p.displayName || "You"} src={avatarUrl} size={72} />
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
      <h2 className="text-xl font-semibold text-ink">Creative Identity</h2>
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
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-ink">Creative Preferences</h2>
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
      <div className="grid gap-5 sm:grid-cols-2">
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
          <h2 className="text-xl font-semibold text-ink">Creator Autonomy</h2>
          <p className="mt-1 text-[15px] text-ink-muted">Choose how CreatorBrain can work with you. Be bold with creativity; be conservative with consequences.</p>
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
      <p className="mt-4 text-sm text-ink-subtle">Rights, commerce and destructive actions can never run automatically — at most, CreatorBrain asks for your approval. Imported material can never change these settings.</p>
    </div>
  );
}

function PrivacySection({ profile, blocked, readiness }: Props) {
  const [visibility, setVisibility] = useState(profile.visibility);
  const { busy, save, status } = useSaver();
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-ink">Privacy & Security</h2>
      <Link href="/settings/audit" className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border-soft px-4 py-3 hover:bg-black/[0.02]">
        <span>
          <span className="block font-medium text-ink">Security & activity</span>
          <span className="text-sm text-ink-muted">Sign-ins, sharing, publishing, approvals and other changes to your account.</span>
        </span>
        <span aria-hidden className="text-ink-muted">›</span>
      </Link>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Your content", "You own your materials and artifacts."],
          ["Private by default", "Only you can see your content unless you share it."],
          ["No hidden AI", "CreatorBrain works only on what you choose, within your autonomy settings."],
        ].map(([t, b]) => (
          <div key={t} className="rounded-2xl bg-surface-muted p-4">
            <p className="font-medium text-ink">{t}</p>
            <p className="mt-1 text-sm text-ink-muted">{b}</p>
          </div>
        ))}
      </div>
      <fieldset>
        <legend className="font-medium text-ink">Profile visibility</legend>
        <div className="mt-2 space-y-2">
          {[
            ["public", "Public", "Anyone can see your profile and public work."],
            ["creators_only", "Creators only", "Signed-in creators can see your profile."],
            ["private", "Private (only me)", "Your profile is hidden; your Huddle presence shows no name."],
          ].map(([v, label, hint]) => (
            <label key={v} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-soft p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-softer">
              <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} className="mt-1 size-4 accent-[var(--color-accent)]" />
              <span>
                <span className="block text-[15px] text-ink">{label}</span>
                <span className="text-sm text-ink-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button loading={busy} onClick={() => save(() => api("/api/v1/creators/me", { method: "PATCH", json: { displayName: profile.displayName, handle: profile.handle, bio: profile.bio, location: profile.location, showLocation: profile.showLocation, collaborationAvailability: profile.collaborationAvailability, visibility } }))}>
            Save visibility
          </Button>
          {status}
        </div>
      </fieldset>

      <section>
        <h3 className="font-medium text-ink">Connected services</h3>
        <ul className="mt-2 space-y-2 text-sm">
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-soft p-3">
            <span>CreatorBrain (AI)</span>
            <Badge tone={readiness.ai.live ? "success" : "warning"}>{readiness.ai.live ? "Connected" : readiness.ai.provider === "offline" ? "Offline development model" : "Not connected"}</Badge>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-soft p-3">
            <span>Huddle voice & video</span>
            <Badge tone={readiness.mediaConfigured ? "success" : "neutral"}>{readiness.mediaConfigured ? "Connected" : "Not connected (text chat only)"}</Badge>
          </li>
        </ul>
        <p className="mt-2 text-xs text-ink-subtle">Your material is never used to train AI models. Imported content is treated as data and can never change your settings.</p>
      </section>

      <section>
        <h3 className="font-medium text-ink">Blocked creators</h3>
        {blocked.length ? (
          <ul className="mt-2 space-y-2">
            {blocked.map((b) => (
              <BlockedRow key={b.id} b={b} />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">You haven&apos;t blocked anyone.</p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border-soft p-4">
          <p className="font-medium text-ink">Data export</p>
          <p className="mt-1 text-sm text-ink-muted">Download your materials, artifacts, conversations and account data.</p>
          <a href="/api/v1/account/export" className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-3" })}>
            <Download className="size-4" aria-hidden /> Export my data
          </a>
        </div>
        <div className="rounded-2xl border border-[#f5d0d0] bg-danger-soft/40 p-4">
          <p className="font-medium text-ink">Delete account</p>
          <p className="mt-1 text-sm text-ink-muted">Permanently delete your account and all your data.</p>
          <Button variant="danger" size="sm" className="mt-3" onClick={() => setDeleteOpen(true)}>
            Delete my account
          </Button>
        </div>
      </section>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function BlockedRow({ b }: { b: { id: string; name: string; handle: string | null } }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl border border-border-soft p-3 text-sm">
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
      <DialogContent title="Delete your account" description="This permanently deletes your profile, materials, artifacts, memories and conversations. It can't be undone.">
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
