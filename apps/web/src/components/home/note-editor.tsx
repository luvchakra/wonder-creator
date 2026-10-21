"use client";
import { cn } from "@wonder/ui";
import { Bold, Italic, List, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { domToMd, mdToHtml } from "@/lib/mini-markdown";

/**
 * A quick note's writing surface (owner, 21 Oct 2026): no box, no border, and a few formats you see as you type — bold,
 * italic and a list. Underneath it is still text with `**`, `_` and `- ` markers (`lib/mini-markdown.ts`), so the note
 * reads fine everywhere else. Pasting brings in plain text only.
 */
export function NoteEditor({
  value,
  onChange,
  label,
  placeholder,
  dictation,
}: {
  value: string;
  onChange: (md: string) => void;
  label: string;
  placeholder: string;
  /** The mic: listening state and its toggle (the page owns the speech-to-text). */
  dictation?: { listening: boolean; onToggle: () => void };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastMd = useRef<string | null>(null);
  const [active, setActive] = useState({ bold: false, italic: false, list: false });

  // Words that arrive from outside (dictation) replace the content and keep the caret at the end; what the person types
  // is never rewritten under them.
  useEffect(() => {
    const el = ref.current;
    if (!el || lastMd.current === value) return;
    lastMd.current = value;
    el.innerHTML = value ? mdToHtml(value) : "";
    if (document.activeElement === el) {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
  }, [value]);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el || document.activeElement !== el) return;
      setActive({ bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"), list: document.queryCommandState("insertUnorderedList") });
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const md = domToMd(el);
    if (!md) el.innerHTML = "";
    lastMd.current = md;
    onChange(md);
  };
  const format = (cmd: "bold" | "italic" | "insertUnorderedList") => {
    ref.current?.focus();
    document.execCommand(cmd);
    emit();
  };
  const tools = [
    { cmd: "bold" as const, label: "Bold", Icon: Bold, on: active.bold },
    { cmd: "italic" as const, label: "Italic", Icon: Italic, on: active.italic },
    { cmd: "insertUnorderedList" as const, label: "Bulleted list", Icon: List, on: active.list },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="toolbar" aria-label="Format" className="-mx-1 flex items-center gap-0.5">
        {tools.map(({ cmd, label: l, Icon, on }) => (
          <button
            key={cmd}
            type="button"
            aria-label={l}
            aria-pressed={on}
            // Keep the writing position: the editor keeps focus while a format is chosen.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => format(cmd)}
            className={cn("inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-black/5", on && "bg-accent-softer text-accent-ink")}
          >
            <Icon className="size-[18px]" aria-hidden />
          </button>
        ))}
        {dictation ? (
          <button
            type="button"
            aria-label={dictation.listening ? "Stop dictating" : "Dictate"}
            aria-pressed={dictation.listening}
            onMouseDown={(e) => e.preventDefault()}
            onClick={dictation.onToggle}
            className={cn("ml-auto inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-black/5", dictation.listening && "bg-accent-softer text-accent-ink")}
          >
            {dictation.listening ? <Square className="size-4 fill-current" aria-hidden /> : <Mic className="size-[18px]" aria-hidden />}
          </button>
        ) : null}
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        autoFocus
        onInput={emit}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.preventDefault();
        }}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto py-2 font-display text-[17px] leading-relaxed text-ink outline-none [overflow-wrap:anywhere]",
          "empty:before:pointer-events-none empty:before:text-ink-subtle empty:before:content-[attr(data-placeholder)]",
          "[&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-6",
        )}
      />
    </div>
  );
}
