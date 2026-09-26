"use client";
import {
  DISCIPLINES,
  EXPERIMENTATION,
  FORMALITY,
  LANGUAGES,
  SUGGESTED_AVOID,
  SUGGESTED_PRESERVE,
  TONES,
  VISUAL_STYLES,
  WRITING_STYLES,
} from "@wonder/creator-identity/vocabulary";
import { BACKGROUNDS, BrandBackground, Button, ChoiceChip, Field, Input, Logo, TagInput, Textarea, cn } from "@wonder/ui";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";

type Step = "welcome" | "about" | "identity" | "style" | "boundaries" | "ready";
const STEPS: Array<{ key: Step; label: string }> = [
  { key: "welcome", label: "Welcome" },
  { key: "about", label: "About you" },
  { key: "identity", label: "Your creative world" },
  { key: "style", label: "Style & voice" },
  { key: "boundaries", label: "Preferences" },
  { key: "ready", label: "All set" },
];

const STYLE_IMAGES: Record<string, string> = {
  Cinematic: BACKGROUNDS.sunsetCoast,
  Documentary: BACKGROUNDS.coastalVillage,
  Minimal: BACKGROUNDS.leafShadow,
  Poetic: BACKGROUNDS.botanicalLeaves,
  Vibrant: BACKGROUNDS.waves,
  Experimental: BACKGROUNDS.softForms,
};

export interface OnboardingState {
  displayName: string;
  handle: string;
  bio: string;
  location: string;
  showLocation: boolean;
  languages: string[];
  disciplines: string[];
  skills: string[];
  interests: string[];
  tones: string[];
  writingStyle: string | null;
  formality: string | null;
  visualStyles: string[];
  experimentation: "stay_close" | "balanced" | "experiment";
  preserve: string[];
  avoid: string[];
  sensitive: string[];
}

const toggle = (list: string[], v: string, max = 12) => (list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v]);

export function OnboardingWizard({ initialStep, initial }: { initialStep: Step; initial: OnboardingState }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(STEPS.some((s) => s.key === initialStep) ? initialStep : "welcome");
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleStatus, setHandleStatus] = useState<{ ok: boolean; msg?: string } | null>(null);
  const [avatarState, setAvatarState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const set = <K extends keyof OnboardingState>(k: K, v: OnboardingState[K]) => setS((p) => ({ ...p, [k]: v }));
  const idx = STEPS.findIndex((x) => x.key === step);
  const shownHandleStatus = step === "about" && s.handle.length >= 3 ? handleStatus : null;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== "about" || s.handle.length < 3) return;
    const t = setTimeout(async () => {
      try {
        const r = await api<{ available: boolean; reason?: string }>(`/api/v1/creators/handle-available?handle=${encodeURIComponent(s.handle)}`);
        setHandleStatus({ ok: r.available, msg: r.reason });
      } catch {
        setHandleStatus(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [s.handle, step]);

  async function save(current: Step, skip = false) {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> =
        current === "about"
          ? { displayName: s.displayName, handle: s.handle, bio: s.bio, location: s.location, showLocation: s.showLocation, languages: s.languages }
          : current === "identity"
            ? { disciplines: s.disciplines, skills: s.skills, interests: s.interests }
            : current === "style"
              ? { tones: s.tones, writingStyle: s.writingStyle, formality: s.formality, visualStyles: s.visualStyles, experimentation: s.experimentation }
              : current === "boundaries"
                ? { preserve: s.preserve, avoid: s.avoid, sensitive: s.sensitive }
                : {};
      const r = await api<{ next: Step | "complete" }>(`/api/v1/creators/onboarding/${current}`, { method: "POST", json: skip ? { skip: true } : payload });
      if (r.next === "complete") {
        router.replace("/");
        router.refresh();
      } else setStep(r.next);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file: File) {
    setAvatarState("uploading");
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api("/api/v1/creators/avatar", { method: "POST", body: fd });
      setAvatarState("done");
    } catch (e) {
      setAvatarState("error");
      setError(errorMessage(e));
    }
  }

  return (
    <main id="main" className="min-h-dvh bg-cream">
      <div className="mx-auto grid min-h-dvh max-w-6xl lg:grid-cols-[260px_1fr]">
        <aside className="border-border-soft px-6 pt-8 lg:border-r lg:pt-12">
          <div className="inline-block rounded-xl bg-white px-2 py-1">
            <Logo height={44} />
          </div>
          <ol className="mt-10 hidden space-y-1 lg:block" aria-label="Onboarding progress">
            {STEPS.map((x, i) => (
              <li key={x.key} aria-current={x.key === step ? "step" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]", x.key === step ? "bg-accent-soft font-medium text-accent-ink" : i < idx ? "text-ink-muted" : "text-ink-subtle")}>
                <span className={cn("inline-flex size-6 items-center justify-center rounded-full border text-xs", i < idx ? "border-accent bg-accent text-white" : x.key === step ? "border-accent" : "border-border")}>
                  {i < idx ? <Check className="size-3.5" aria-hidden /> : i + 1}
                </span>
                {x.label}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-ink-subtle lg:hidden">
            Step {idx + 1} of {STEPS.length} · {STEPS[idx].label}
          </p>
        </aside>

        <section className="px-5 pb-16 pt-6 sm:px-10 lg:pt-12">
          {step === "welcome" ? (
            <BrandBackground src={BACKGROUNDS.archesSea} overlay="cream" className="rounded-3xl border border-border-soft" position="70% center">
              <div className="max-w-lg px-6 py-12 sm:px-10 sm:py-16">
                <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl leading-tight text-ink sm:text-5xl focus:outline-none">
                  Welcome to
                  <br />
                  Wonder Creator
                </h1>
                <p className="mt-4 text-lg text-ink-muted">A place to think, create and bring your creative ideas to life.</p>
                <ul className="mt-8 space-y-3 text-[15px] text-ink">
                  <li>
                    <strong className="font-medium">Bring anything</strong> — notes, files, voice and more
                  </li>
                  <li>
                    <strong className="font-medium">Create with CreatorBrain</strong> — turn ideas into beautiful work
                  </li>
                  <li>
                    <strong className="font-medium">Organize & share</strong> — your creations, your way
                  </li>
                </ul>
                <p className="mt-6 text-sm text-ink-muted">A few quick questions help CreatorBrain work in your voice. Only your name and handle are required.</p>
                <Button size="lg" className="mt-8" onClick={() => setStep("about")}>
                  Let&apos;s begin <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>
            </BrandBackground>
          ) : null}

          {step === "about" ? (
            <StepShell title="Tell us about you" subtitle="This helps CreatorBrain understand you better." headingRef={headingRef}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" htmlFor="displayName">
                  <Input id="displayName" value={s.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={80} autoComplete="name" />
                </Field>
                <Field
                  label="Handle"
                  htmlFor="handle"
                  error={shownHandleStatus && !shownHandleStatus.ok ? shownHandleStatus.msg ?? "That handle isn't available." : null}
                  hint={shownHandleStatus?.ok ? "Available ✓" : "Letters, numbers and underscores."}
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle">@</span>
                    <Input id="handle" className="pl-8" value={s.handle} onChange={(e) => set("handle", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30))} aria-invalid={shownHandleStatus?.ok === false} />
                  </div>
                </Field>
                <Field label="Short description" htmlFor="bio" counter={`${s.bio.length}/300`} className="sm:col-span-2">
                  <Textarea id="bio" value={s.bio} onChange={(e) => set("bio", e.target.value.slice(0, 300))} placeholder="Visual artist, filmmaker and storyteller exploring human stories through visuals, sound and words." />
                </Field>
                <Field label="Location (optional)" htmlFor="location">
                  <Input id="location" value={s.location} onChange={(e) => set("location", e.target.value)} placeholder="Mumbai, India" maxLength={120} />
                </Field>
                <div className="flex items-end">
                  <label className="flex min-h-11 items-center gap-2 text-sm text-ink-muted">
                    <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={s.showLocation} onChange={(e) => set("showLocation", e.target.checked)} />
                    Show my location on my profile
                  </label>
                </div>
                <Field label="Photo (optional)" htmlFor="avatar" hint={avatarState === "done" ? "Photo saved." : avatarState === "uploading" ? "Uploading…" : "JPG, PNG or WebP up to 5 MB."} className="sm:col-span-2">
                  <input id="avatar" type="file" accept="image/*" className="block text-sm file:mr-3 file:h-10 file:rounded-full file:border-0 file:bg-accent-soft file:px-4 file:text-accent-ink" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
                </Field>
                <div className="sm:col-span-2">
                  <p className="mb-2 text-sm font-medium text-ink">Languages you create in</p>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.slice(0, 12).map((l) => (
                      <ChoiceChip key={l} selected={s.languages.includes(l)} onToggle={() => set("languages", toggle(s.languages, l, 10))}>
                        {l}
                      </ChoiceChip>
                    ))}
                  </div>
                </div>
              </div>
            </StepShell>
          ) : null}

          {step === "identity" ? (
            <StepShell title="Your creative world" subtitle="What do you make? Pick everything that feels like you." headingRef={headingRef}>
              <p className="mb-2 text-sm font-medium text-ink">Creative disciplines</p>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...DISCIPLINES, ...s.disciplines])].map((d) => (
                  <ChoiceChip key={d} selected={s.disciplines.includes(d)} onToggle={() => set("disciplines", toggle(s.disciplines, d))}>
                    {d}
                  </ChoiceChip>
                ))}
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field label="Skills" htmlFor="skills" hint="Press Enter to add.">
                  <TagInput id="skills" value={s.skills} onChange={(v) => set("skills", v)} placeholder="Editing, lyric writing…" max={20} />
                </Field>
                <Field label="Interests" htmlFor="interests" hint="Press Enter to add.">
                  <TagInput id="interests" value={s.interests} onChange={(v) => set("interests", v)} placeholder="Travel, family stories…" max={20} />
                </Field>
              </div>
            </StepShell>
          ) : null}

          {step === "style" ? (
            <StepShell title="How do you like to create?" subtitle="Set your creative style and voice. You can change this anytime." headingRef={headingRef}>
              <p className="mb-2 text-sm font-medium text-ink">Preferred tone</p>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <ChoiceChip key={t} selected={s.tones.includes(t)} onToggle={() => set("tones", toggle(s.tones, t, 6))}>
                    {t}
                  </ChoiceChip>
                ))}
              </div>
              <p className="mb-2 mt-6 text-sm font-medium text-ink">Visual style</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {VISUAL_STYLES.map((v) => {
                  const on = s.visualStyles.includes(v);
                  return (
                    <button key={v} type="button" aria-label={`${v} visual style`} aria-pressed={on} onClick={() => set("visualStyles", toggle(s.visualStyles, v, 6))} className={cn("group overflow-hidden rounded-2xl border-2 text-left transition-colors", on ? "border-accent" : "border-transparent")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={STYLE_IMAGES[v]} alt="" className="aspect-[4/3] w-full object-cover" />
                      <span className="flex items-center justify-between bg-surface px-3 py-2 text-sm">
                        {v}
                        {on ? <Check className="size-4 text-accent-ink" aria-hidden /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-ink">Writing style</p>
                  <div className="flex flex-wrap gap-2">
                    {WRITING_STYLES.map((w) => (
                      <ChoiceChip key={w.value} selected={s.writingStyle === w.value} onToggle={() => set("writingStyle", s.writingStyle === w.value ? null : w.value)}>
                        {w.label}
                      </ChoiceChip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-ink">Formality</p>
                  <div className="flex flex-wrap gap-2">
                    {FORMALITY.map((f) => (
                      <ChoiceChip key={f.value} selected={s.formality === f.value} onToggle={() => set("formality", s.formality === f.value ? null : f.value)}>
                        {f.label}
                      </ChoiceChip>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mb-2 mt-6 text-sm font-medium text-ink">Experimentation</p>
              <div className="flex flex-wrap gap-2">
                {EXPERIMENTATION.map((x) => (
                  <ChoiceChip key={x.value} selected={s.experimentation === x.value} onToggle={() => set("experimentation", x.value)}>
                    {x.label}
                  </ChoiceChip>
                ))}
              </div>
            </StepShell>
          ) : null}

          {step === "boundaries" ? (
            <StepShell title="Make it yours" subtitle="Tell CreatorBrain what to protect and what to steer away from." headingRef={headingRef}>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Things to preserve" htmlFor="preserve">
                  <TagInput id="preserve" value={s.preserve} onChange={(v) => set("preserve", v)} suggestions={SUGGESTED_PRESERVE} placeholder="Add your own…" />
                </Field>
                <Field label="Things to avoid" htmlFor="avoid">
                  <TagInput id="avoid" value={s.avoid} onChange={(v) => set("avoid", v)} suggestions={SUGGESTED_AVOID} placeholder="Add your own…" />
                </Field>
                <Field label="Handle with care (sensitive subjects)" htmlFor="sensitive" className="sm:col-span-2" hint="CreatorBrain will approach these gently and never invent details about them.">
                  <TagInput id="sensitive" value={s.sensitive} onChange={(v) => set("sensitive", v)} placeholder="e.g. my father's illness" />
                </Field>
              </div>
            </StepShell>
          ) : null}

          {step === "ready" ? (
            <BrandBackground src={BACKGROUNDS.pastelClouds} overlay="soft" className="rounded-3xl border border-border-soft">
              <div className="max-w-xl px-6 py-14 sm:px-10">
                <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl text-ink focus:outline-none">
                  You&apos;re all set, {s.displayName.split(" ")[0] || "creator"}.
                </h1>
                <p className="mt-3 text-lg text-ink-muted">Bring something — a thought, a photo, a voice note — and let&apos;s see what it can become.</p>
                <p className="mt-3 text-sm text-ink-muted">Everything you shared is saved to your Creative Memory, where you can edit or remove it anytime.</p>
                <Button size="lg" className="mt-8" loading={busy} onClick={() => save("ready")}>
                  Enter your studio <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>
            </BrandBackground>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 text-sm text-danger">
              {error}
            </p>
          ) : null}

          {step !== "welcome" && step !== "ready" ? (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep(STEPS[Math.max(0, idx - 1)].key)}>
                Back
              </Button>
              <div className="flex gap-2">
                {step !== "about" ? (
                  <Button variant="ghost" onClick={() => save(step, true)} disabled={busy}>
                    Skip for now
                  </Button>
                ) : null}
                <Button onClick={() => save(step)} disabled={busy || (step === "about" && (!s.displayName.trim() || s.handle.length < 3 || shownHandleStatus?.ok === false))}>
                  {busy ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> : null}
                  Next <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function StepShell({ title, subtitle, children, headingRef }: { title: string; subtitle: string; children: React.ReactNode; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="max-w-3xl motion-safe:animate-[rise_250ms_ease-out]">
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl text-ink sm:text-4xl focus:outline-none">
        {title}
      </h1>
      <p className="mb-8 mt-2 text-ink-muted">{subtitle}</p>
      {children}
    </div>
  );
}
