import { artifactType } from "@wonder/creator-studio";

export interface QualityCheck {
  key: string;
  label: string;
  status: "good" | "attention";
  note: string;
}

const LABELS: Record<string, string[]> = {
  writing: ["Structure", "Coherence", "Voice consistency", "Pacing", "Repetition"],
  screenplay: ["Story structure", "Character consistency", "Dialogue quality", "Formatting", "Scene logic"],
  verse: ["Thematic consistency", "Rhythm", "Repetition", "Voice"],
  visual: ["Composition", "Consistency", "Creator style", "Reference adherence"],
};

/** Which checks apply to an artifact type (shown before and during analysis). */
export function checksFor(type: string): string[] {
  const def = artifactType(type);
  if (def.format === "screenplay") return LABELS.screenplay;
  if (def.format === "verse") return LABELS.verse;
  if (def.category === "visual") return LABELS.visual;
  return LABELS.writing;
}

/** Deterministic checks that don't need a model. They produce suggestions, never rewrites. */
export function heuristicChecks(type: string, content: string, opts: { avoid?: string[] } = {}): QualityCheck[] {
  const def = artifactType(type);
  const checks: QualityCheck[] = [];
  const text = content.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  checks.push(
    words.length < 12
      ? { key: "length", label: "Length", status: "attention", note: "This is very short — there may be more to say." }
      : { key: "length", label: "Length", status: "good", note: `${words.length} words.` },
  );

  // Repetition: the same non-trivial line or 4-word phrase repeated.
  const counts = new Map<string, number>();
  for (let i = 0; i + 4 <= words.length; i++) {
    const k = words.slice(i, i + 4).join(" ").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "");
    if (k.length > 12) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const repeated = [...counts.entries()].filter(([, n]) => n >= (def.format === "verse" ? 4 : 3));
  checks.push(
    repeated.length
      ? { key: "repetition", label: "Repetition", status: "attention", note: `“${repeated[0][0]}” repeats ${repeated[0][1]} times${def.format === "verse" ? " — intentional refrain?" : "."}` }
      : { key: "repetition", label: "Repetition", status: "good", note: "No accidental repetition found." },
  );

  if (def.format === "screenplay") {
    const headings = lines.filter((l) => /^(INT\.|EXT\.|INT\/EXT\.)/.test(l)).length;
    checks.push(
      headings
        ? { key: "formatting", label: "Formatting", status: "good", note: `${headings} scene heading${headings === 1 ? "" : "s"}.` }
        : { key: "formatting", label: "Formatting", status: "attention", note: "No scene headings (INT./EXT.) yet." },
    );
  }
  if (def.format === "verse") {
    const long = lines.filter((l) => l.split(/\s+/).length > 16).length;
    checks.push(
      long > lines.length / 3
        ? { key: "rhythm", label: "Rhythm", status: "attention", note: "Several lines run long; consider breaking them for breath." }
        : { key: "rhythm", label: "Rhythm", status: "good", note: "Line lengths leave room to breathe." },
    );
  }
  const lower = text.toLowerCase();
  const avoided = (opts.avoid ?? []).filter((a) => a.length > 3 && lower.includes(a.toLowerCase()));
  checks.push(
    avoided.length
      ? { key: "constraints", label: "Your constraints", status: "attention", note: `Includes something you asked to avoid: ${avoided.join(", ")}.` }
      : { key: "constraints", label: "Your constraints", status: "good", note: "Respects the things you asked to avoid." },
  );
  return checks;
}

export function mergeChecks(a: QualityCheck[], b: QualityCheck[]): QualityCheck[] {
  const out = new Map<string, QualityCheck>();
  for (const c of [...a, ...b]) {
    const prev = out.get(c.key);
    // "attention" wins so problems are never hidden.
    if (!prev || (prev.status === "good" && c.status === "attention")) out.set(c.key, c);
  }
  return [...out.values()];
}
