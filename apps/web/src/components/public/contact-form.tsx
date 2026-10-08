"use client";
import { Button, Field, Input, Select, Textarea } from "@wonder/ui";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { CONTACT_TOPICS, CONTACT_TOPIC_LABEL, type ContactTopic } from "@/lib/contact-topics";
import { api, errorMessage } from "@/lib/client";

/**
 * "Send us a message" on /contact (owner, 8 Oct 2026: "implement similar to WonderJobs"): name, the address to reply
 * to, what it's about, the words — one button. The message is saved on our side before anything else, so Send is
 * honest the moment it succeeds; the team is mailed from there. One id is made when the form opens so a double tap
 * or a retry lands once. A hidden field catches bots.
 */
export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", topic: "general" as ContactTopic, message: "", company: "" });
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = useRef<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    clientId.current ??= crypto.randomUUID();
    try {
      await api("/api/v1/contact", { method: "POST", json: { ...form, clientId: clientId.current, page: location.pathname } });
      setSentTo(form.email.trim());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div role="status" className="rounded-2xl bg-accent-softer px-4 py-4">
        <p className="flex items-center gap-2 font-display text-[19px] leading-snug text-ink">
          <Check className="size-5 text-success-ink" aria-hidden /> Message sent
        </p>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">Thank you, {form.name.trim().split(" ")[0]}. We&rsquo;ll reply to {sentTo}.</p>
        <button
          type="button"
          onClick={() => {
            clientId.current = null;
            setForm({ name: "", email: "", topic: "general", message: "", company: "" });
            setSentTo(null);
          }}
          className="mt-1 inline-flex min-h-11 items-center text-[14px] font-medium text-accent-ink underline-offset-4 hover:underline"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} aria-label="Send us a message" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your name" htmlFor="contact-name">
          <Input id="contact-name" name="name" autoComplete="name" value={form.name} onChange={set("name")} required minLength={2} maxLength={120} />
        </Field>
        <Field label="Your email" htmlFor="contact-email">
          <Input id="contact-email" name="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required maxLength={200} />
        </Field>
      </div>
      <Field label="About" htmlFor="contact-topic">
        <Select id="contact-topic" name="topic" value={form.topic} onChange={set("topic")}>
          {CONTACT_TOPICS.map((t) => (
            <option key={t} value={t}>
              {CONTACT_TOPIC_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Your message" htmlFor="contact-message">
        <Textarea id="contact-message" name="message" value={form.message} onChange={set("message")} required minLength={10} maxLength={4000} rows={5} />
      </Field>
      {/* Honeypot: out of sight and out of the tab order. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-company">Company</label>
        <input id="contact-company" name="company" tabIndex={-1} autoComplete="off" value={form.company} onChange={set("company")} />
      </div>
      {error ? (
        <p role="alert" className="text-[14px] text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={busy} className="w-full sm:w-auto">
        Send message
      </Button>
      <p className="text-[13px] text-ink-muted">
        We use your name and email only to reply, and keep the message for 12 months. See the{" "}
        <Link href="/legal/privacy" className="font-medium text-accent-ink underline-offset-4 hover:underline">
          Privacy notice
        </Link>
        .
      </p>
    </form>
  );
}
