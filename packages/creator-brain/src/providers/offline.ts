import type {
  CreativeModelProvider,
  GenerateChunk,
  GenerateInput,
  GenerateOutput,
  StructuredInput,
  StructuredOutput,
  TaskKind,
} from "./types";

/**
 * Deterministic offline provider for development and tests.
 * It never pretends to be a live model: `live = false`, outputs are labelled as offline drafts,
 * and readiness surfaces it in the UI. Outputs are derived only from the provided hints.
 */
export const OFFLINE_MODEL = "offline-deterministic-v1";

const FORMAT_DRAFTS: Record<string, (title: string, words: string[]) => string> = {
  verse: (title, w) =>
    [
      `${title}`,
      "",
      `Some ${w[0] ?? "moments"} don't ask to be remembered —`,
      `they stay, like light on a ${w[1] ?? "doorway"},`,
      `warm and a little broken with age.`,
      "",
      `I carry the ${w[2] ?? "silence"} the way you taught me:`,
      `gently, and without hurry.`,
    ].join("\n"),
  screenplay: (title, w) =>
    [
      "FADE IN:",
      "",
      `EXT. ${(w[0] ?? "old house").toUpperCase()} - SUNRISE`,
      "",
      `The morning light falls on a weathered wooden door. A hand reaches for the latch.`,
      "",
      "                    NARRATOR (V.O.)",
      `          Some stories don't start with a beginning.`,
      `          They live in the little ${w[1] ?? "moments"}.`,
      "",
      `INT. ${(w[2] ?? "kitchen").toUpperCase()} - CONTINUOUS`,
      "",
      `Dust in the air. A photograph on the table: ${title}.`,
    ].join("\n"),
  prose: (title, w) =>
    [
      `# ${title}`,
      "",
      `It begins with ${w[0] ?? "a small detail"} — the kind you only notice once it is gone. ` +
        `Around it gather ${w[1] ?? "memories"} and ${w[2] ?? "places"}, each asking to be kept.`,
      "",
      `This draft keeps the structure simple: an opening image, a turn, and a quiet ending that returns to ${w[0] ?? "the beginning"}.`,
    ].join("\n"),
  concept: (title, w) =>
    [
      `# ${title}`,
      "",
      `**Idea:** A ${w[0] ?? "personal"} visual story built around ${w[1] ?? "light"} and ${w[2] ?? "memory"}.`,
      `**Mood:** Warm, reflective, cinematic.`,
      `**Palette:** Golden hour ambers, soft lavender shadows.`,
      `**Sequence:** 1. Establishing image  2. Detail  3. Human moment  4. Return`,
    ].join("\n"),
  list: (title, w) =>
    [`# ${title}`, "", `1. Opening — ${w[0] ?? "arrival"}`, `2. Detail — ${w[1] ?? "hands"}`, `3. Turn — ${w[2] ?? "a memory"}`, `4. Close — the same place, changed`].join("\n"),
};

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function usageFor(text: string) {
  return { inputTokens: 0, outputTokens: Math.ceil(text.length / 4) };
}

export class OfflineProvider implements CreativeModelProvider {
  readonly name = "offline";
  readonly live = false;

  modelFor(_task: TaskKind): string {
    return OFFLINE_MODEL;
  }

  private text(input: GenerateInput): string {
    const h = input.hints ?? {};
    const words = (h.keywords ?? []).map((w) => w.toLowerCase());
    const title = h.title || "Untitled";
    if (input.task === "generate" || input.task === "transform") {
      const draft = (FORMAT_DRAFTS[h.format ?? "prose"] ?? FORMAT_DRAFTS.prose)(title, words);
      return draft;
    }
    if (input.task === "refine") {
      const current = typeof input.messages.at(-1)?.content === "string" ? (input.messages.at(-1)!.content as string) : "";
      const body = current.split("<current_draft>")[1]?.split("</current_draft>")[0]?.trim() ?? "";
      if (h.action === "shorter") {
        const lines = body.split("\n").filter(Boolean);
        return lines.slice(0, Math.max(2, Math.ceil(lines.length / 2))).join("\n");
      }
      return body ? `${body}\n\n(Revised offline: ${h.action ?? "refined"}.)` : "";
    }
    return `I looked at what you shared${words.length ? ` — ${words.slice(0, 3).join(", ")}` : ""}. Tell me what you'd like to make, or I can suggest directions.`;
  }

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const text = this.text(input);
    return { text, usage: usageFor(text), model: OFFLINE_MODEL, provider: this.name };
  }

  async *stream(input: GenerateInput): AsyncIterable<GenerateChunk> {
    const output = await this.generate(input);
    for (const piece of output.text.match(/[\s\S]{1,48}/g) ?? []) yield { type: "text", text: piece };
    yield { type: "done", output };
  }

  async structured<T>(input: StructuredInput<T>): Promise<StructuredOutput<T>> {
    const h = input.hints ?? {};
    const kw = (h.keywords ?? []).map(titleCase);
    const refs = h.refs ?? [];
    let value: unknown;
    switch (input.schemaName) {
      case "understanding":
        value = {
          summary: `This material circles around ${kw.slice(0, 3).join(", ") || "a personal moment"}. It feels personal and reflective.`,
          themes: kw.slice(0, 5).length ? kw.slice(0, 5) : ["Memory"],
          moods: ["Reflective", "Warm"],
          suggestedTitle: h.title || (kw[0] ? `${kw[0]} Study` : "A Life in Moments"),
          perMaterial: refs.map((ref) => ({ ref, note: "Included in the overall understanding." })),
        };
        break;
      case "directions":
        value = {
          intro: "I found three directions this material could take.",
          directions: [
            { title: "A memory-driven short film", artifactType: "short_film", description: "An intimate personal narrative on film.", why: `Your material carries ${kw[0] ?? "strong personal"} imagery that wants to move.`, styleTags: ["Cinematic", "Personal"], materialRefs: refs },
            { title: "A poetic visual essay", artifactType: "photo_essay", description: "Images and voice, side by side.", why: "The images and notes already read like stanzas.", styleTags: ["Visual", "Reflective"], materialRefs: refs },
            { title: "A song from these memories", artifactType: "song_concept", description: "Lyrics and mood direction.", why: `The ${kw[1] ?? "emotional"} thread would carry well in music.`, styleTags: ["Musical", "Nostalgic"], materialRefs: refs },
          ],
        };
        break;
      case "publication_copy":
        value = {
          title: h.title || "Untitled",
          caption: `${h.title || "A new piece"}${kw.length ? ` — ${kw.slice(0, 3).join(", ").toLowerCase()}` : ""}. Made in my own voice.`,
          description: `A new piece${kw.length ? ` about ${kw.slice(0, 2).join(" and ").toLowerCase()}` : ""}. (Drafted offline.)`,
        };
        break;
      case "plan":
        value = { title: h.title || "Untitled", approach: "Open on a concrete image, turn on a memory, close by returning changed.", outline: ["Opening image", "The turn", "Return"] };
        break;
      case "critique":
        value = {
          checks: [
            { key: "structure", label: "Structure", status: "good", note: "Clear opening and close." },
            { key: "voice", label: "Voice consistency", status: "good", note: "Matches your saved voice." },
            { key: "pacing", label: "Pacing", status: "attention", note: "The middle could breathe a little more." },
          ],
          suggestions: [{ title: "Try a closer detail", detail: "A single physical object can carry more emotion than a description." }],
        };
        break;
      case "task_plan":
        value = {
          tasks: [
            { title: "Gather the reference material in one place", why: "Everyone starts from the same picture." },
            { title: "Agree on the look and tone", why: "Early choices save rework later." },
            { title: "Plan a first rough version", why: "Something to react to beats a blank page." },
          ],
          missing: ["A date for the first review"],
        };
        break;
      case "memories":
        value = { memories: [] };
        break;
      case "image_description":
        value = { description: "An image (offline mode can't see images).", subjects: [], moods: [], palette: [] };
        break;
      case "intent":
        value = { intent: "chat", artifactType: null };
        break;
      default:
        throw new Error(`offline provider has no fixture for ${input.schemaName}`);
    }
    const parsed = input.schema.parse(value);
    return { value: parsed, usage: usageFor(JSON.stringify(value)), model: OFFLINE_MODEL, provider: this.name };
  }
}
