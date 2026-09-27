"use client";
import { Badge, Button, Input, Select, Textarea } from "@wonder/ui";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

export interface ComposerOption {
  value: string;
  label: string;
}

/**
 * A message box with an optional "about" context and a CreatorBrain draft. A draft only ever fills the box:
 * it's clearly marked as not sent until the creator presses Send.
 */
export function MessageComposer({
  id,
  label,
  placeholder,
  draftTarget,
  about,
  aboutLabel = "About",
  onSend,
  className,
}: {
  id: string;
  label: string;
  placeholder: string;
  /** Where CreatorBrain reads recent messages from. */
  draftTarget: { crewId: string } | { threadId: string };
  about?: ComposerOption[];
  aboutLabel?: string;
  onSend: (m: { body: string; about: string | null; draftedByAi: boolean }) => Promise<void>;
  className?: string;
}) {
  const [body, setBody] = useState("");
  const [aboutValue, setAboutValue] = useState("");
  const [drafted, setDrafted] = useState(false);
  const [asking, setAsking] = useState(false);
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSend({ body, about: aboutValue || null, draftedByAi: drafted });
          setBody("");
          setAboutValue("");
          setDrafted(false);
          setOffline(false);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {drafted ? (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted" role="status">
          <Badge tone="warning">Draft — not sent</Badge>
          {offline ? "AI isn't connected, so this is only a starting point." : "Written by CreativeMind. Edit it, then send when you're ready."}
        </p>
      ) : null}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Textarea
        id={id}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          if (!e.target.value) setDrafted(false);
        }}
        maxLength={4000}
        placeholder={placeholder}
        className="min-h-16"
      />
      {asking ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-intent`} className="sr-only">
            What should the message say?
          </label>
          <Input id={`${id}-intent`} value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="What should it say? e.g. ask Kit to share the night shots by Friday" maxLength={1000} className="min-w-0 flex-1" />
          <Button
            type="button"
            variant="secondary"
            loading={drafting}
            disabled={!intent.trim()}
            onClick={async () => {
              setDrafting(true);
              setError(null);
              try {
                const aboutText = about?.find((o) => o.value === aboutValue)?.label ?? null;
                const r = await api<{ draft: string; offline: boolean }>("/api/v1/messages/draft", { method: "POST", json: { ...draftTarget, intent, about: aboutText } });
                setBody(r.draft);
                setDrafted(true);
                setOffline(r.offline);
                setAsking(false);
                setIntent("");
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setDrafting(false);
              }
            }}
          >
            Write draft
          </Button>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {about?.length ? (
          <>
            <label htmlFor={`${id}-about`} className="sr-only">
              {aboutLabel}
            </label>
            <Select id={`${id}-about`} value={aboutValue} onChange={(e) => setAboutValue(e.target.value)} className="w-auto min-w-0 flex-1 sm:max-w-xs">
              <option value="">{aboutLabel}: nothing specific</option>
              {about.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </>
        ) : null}
        {!asking ? (
          <Button type="button" variant="ghost" onClick={() => setAsking(true)}>
            <Sparkles className="size-4" aria-hidden /> Draft with CreativeMind
          </Button>
        ) : null}
        <Button type="submit" loading={busy} disabled={!body.trim()} className="ml-auto">
          Send
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
