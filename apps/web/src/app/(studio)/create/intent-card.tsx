"use client";
import { ARTIFACT_TYPES, artifactType } from "@wonder/creator-studio/types";
import { Button, Field, Input, Select } from "@wonder/ui";
import { useState } from "react";
import type { MaterialCardData } from "@/components/cards";

export interface IntentPayload {
  artifactType: string | null;
  candidateTypes: string[];
  missingInformation: Array<"format" | "length" | "audience" | "emphasis">;
  safeAssumptions: string[];
  consequentialAssumptions: Array<{ key: "publish" | "commercial" | "imitation"; text: string }>;
  defaults: { format: string; length?: "short" | "medium" | "long"; style?: "preserve" | "experiment" };
}

export interface ConfirmedBrief {
  format: string;
  audience?: string;
  length?: "short" | "medium" | "long";
  tone?: string;
  style?: "preserve" | "experiment";
  emphasisMaterialId?: string | null;
}

const LENGTHS = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
] as const;

/**
 * What CreatorBrain understood, editable before a creation run. Only the missing choices are asked;
 * safe assumptions are listed and can be adjusted; consequential ones must each be confirmed.
 */
export function IntentCard({
  id,
  intent,
  materialIds,
  materials,
  busy,
  answered,
  onConfirm,
}: {
  id: string;
  intent: IntentPayload;
  materialIds: string[];
  materials: Record<string, MaterialCardData>;
  busy: boolean;
  answered: boolean;
  onConfirm: (brief: ConfirmedBrief, acknowledged: string[]) => void;
}) {
  const missing = new Set(intent.missingInformation);
  const [format, setFormat] = useState(intent.defaults.format);
  const [audience, setAudience] = useState("");
  const [length, setLength] = useState<ConfirmedBrief["length"]>(intent.defaults.length);
  const [tone, setTone] = useState("");
  const [style, setStyle] = useState<ConfirmedBrief["style"]>(intent.defaults.style ?? "preserve");
  const [emphasis, setEmphasis] = useState<string>("");
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const allAcknowledged = intent.consequentialAssumptions.every((c) => acknowledged.includes(c.key));
  const formatOptions = intent.candidateTypes.length ? [...intent.candidateTypes, ...ARTIFACT_TYPES.map((t) => t.type).filter((t) => !intent.candidateTypes.includes(t))] : ARTIFACT_TYPES.map((t) => t.type);

  if (answered) {
    return <p className="mt-2 text-sm text-ink-subtle">Answered — I&apos;m working from your choices.</p>;
  }

  const brief = (): ConfirmedBrief => ({
    format,
    ...(audience.trim() ? { audience: audience.trim() } : {}),
    ...(length ? { length } : {}),
    ...(tone.trim() ? { tone: tone.trim() } : {}),
    style,
    emphasisMaterialId: emphasis || null,
  });

  return (
    <form
      className="mt-3 space-y-4 rounded-2xl border border-[#cfd0ff] bg-surface p-4"
      aria-label="What I understood"
      onSubmit={(e) => {
        e.preventDefault();
        if (allAcknowledged) onConfirm(brief(), acknowledged);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Format" htmlFor={`${id}-format`} hint={missing.has("format") ? "You mentioned more than one — which should it be?" : undefined}>
          <Select id={`${id}-format`} value={format} onChange={(e) => setFormat(e.target.value)}>
            {formatOptions.map((t) => (
              <option key={t} value={t}>
                {artifactType(t).label}
              </option>
            ))}
          </Select>
        </Field>
        {missing.has("length") ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Length</legend>
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map((l) => (
                <label key={l.value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink">
                  <input type="radio" name={`${id}-length`} value={l.value} checked={length === l.value} onChange={() => setLength(l.value)} className="accent-[var(--color-accent)]" />
                  {l.label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {missing.has("audience") ? (
          <Field label="Who is it for?" htmlFor={`${id}-audience`} hint="Readers, followers, a client, a festival jury…">
            <Input id={`${id}-audience`} value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={120} />
          </Field>
        ) : null}
        {missing.has("emphasis") && materialIds.length ? (
          <Field label="Lead with" htmlFor={`${id}-emphasis`} hint="Which piece matters most?">
            <Select id={`${id}-emphasis`} value={emphasis} onChange={(e) => setEmphasis(e.target.value)}>
              <option value="">All equally</option>
              {materialIds.map((mid) => (
                <option key={mid} value={mid}>
                  {materials[mid]?.title || "Untitled material"}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      <details className="rounded-xl bg-surface-muted p-3">
        <summary className="cursor-pointer text-sm font-medium text-ink">I&apos;ll assume · adjust</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          {intent.safeAssumptions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Tone" htmlFor={`${id}-tone`} hint="Leave empty for your usual voice.">
            <Input id={`${id}-tone`} value={tone} onChange={(e) => setTone(e.target.value)} maxLength={120} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Style</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["preserve", "Keep my usual style"],
                  ["experiment", "Experiment"],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink">
                  <input type="radio" name={`${id}-style`} value={v} checked={style === v} onChange={() => setStyle(v)} className="accent-[var(--color-accent)]" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </details>

      {intent.consequentialAssumptions.length ? (
        <fieldset className="space-y-2 rounded-xl bg-warning-soft p-3">
          <legend className="sr-only">Please confirm</legend>
          <p className="text-sm font-medium text-warning-ink">Please confirm before I start</p>
          {intent.consequentialAssumptions.map((c) => (
            <label key={c.key} className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
                checked={acknowledged.includes(c.key)}
                onChange={(e) => setAcknowledged((a) => (e.target.checked ? [...a, c.key] : a.filter((k) => k !== c.key)))}
              />
              {c.text}
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !allAcknowledged}>
          Create with these choices
        </Button>
        {!intent.consequentialAssumptions.length ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onConfirm({ format: intent.defaults.format, length: intent.defaults.length, style: intent.defaults.style }, [])}>
            Use your judgment
          </Button>
        ) : null}
      </div>
    </form>
  );
}
