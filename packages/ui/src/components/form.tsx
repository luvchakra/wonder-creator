"use client";
import { Check, X } from "lucide-react";
import * as React from "react";
import { cn } from "../cn";

const fieldBase =
  "w-full rounded-2xl border border-border bg-surface px-4 text-[15px] text-ink shadow-[0_2px_8px_-4px_rgb(107_91_149/0.10)] placeholder:text-ink-subtle/80 " +
  "focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 disabled:opacity-60 aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-11", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, "h-11 appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...props}>
      {children}
    </select>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
  counter,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  htmlFor: string;
  className?: string;
  counter?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
          {label}
        </label>
        {counter ? <span className="text-xs text-ink-subtle">{counter}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Toggleable chip for known-choice multi-select (state is also conveyed by a check icon, not color alone). */
export function ChoiceChip({ selected, onToggle, children, className, disabled }: { selected: boolean; onToggle: () => void; children: React.ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        selected ? "border-accent bg-accent-soft font-medium text-accent-ink" : "border-border bg-surface text-ink-muted hover:border-[#cfd0ff]",
        className,
      )}
    >
      {selected ? <Check className="size-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

/** Free-form tag entry with removable chips. */
export function TagInput({ id, value, onChange, placeholder, max = 12, suggestions = [] }: { id: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; suggestions?: readonly string[] }) {
  const [draft, setDraft] = React.useState("");
  const add = (t: string) => {
    const v = t.trim();
    if (!v || value.some((x) => x.toLowerCase() === v.toLowerCase()) || value.length >= max) return;
    onChange([...value, v]);
    setDraft("");
  };
  const remaining = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-sm text-accent-ink">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="inline-flex size-7 items-center justify-center rounded-full hover:bg-white/70">
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add(draft)}
      />
      {remaining.length ? (
        <div className="flex flex-wrap gap-2">
          {remaining.slice(0, 6).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="min-h-9 rounded-full border border-dashed border-border px-3 text-sm text-ink-muted hover:border-accent hover:text-accent-ink">
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
