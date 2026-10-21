"use client";
import { Button, ConfirmDialog, Field, Input } from "@wonder/ui";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

type View = { configured: boolean; source: "database" | "environment" | "none"; masked: string | null; updatedAt: string | null };
type Test = { state: "connected"; jobs: number; site: string } | { state: "wrong_key" } | { state: "not_configured" } | { state: "unavailable" };

const TEST_LINE: Record<Test["state"], string> = { connected: "", wrong_key: "Wrong key: WonderJobs refused it (401).", not_configured: "No key is saved yet.", unavailable: "Unavailable: WonderJobs couldn't be reached. Try again shortly." };

/**
 * Paste the career-site key (wjcs_…) from WonderJobs › Hiring › Jobs › Career sites › Add a career site › "On our own
 * website". It goes to this app's server and is never shown again: only the mask comes back.
 */
export function CareersKeyForm({ initial }: { initial: View }) {
  const [view, setView] = useState(initial);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"save" | "clear" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    setLine(null);
    try {
      setView(await api<View>("/api/v1/admin/careers-key", { method: "POST", json: { key } }));
      setKey("");
      setLine("Saved.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  async function clear() {
    setBusy("clear");
    setError(null);
    try {
      setView(await api<View>("/api/v1/admin/careers-key", { method: "DELETE" }));
      setLine("Cleared.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      setAsking(false);
    }
  }
  async function test() {
    setBusy("test");
    setError(null);
    try {
      const r = await api<Test>("/api/v1/admin/careers-key/test", { method: "POST" });
      setLine(r.state === "connected" ? `Connected to ${r.site}: ${r.jobs} open position${r.jobs === 1 ? "" : "s"}.` : TEST_LINE[r.state]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <section aria-labelledby="careers-key-now" className="rounded-2xl border border-border-soft bg-surface/90 p-4">
        <h2 id="careers-key-now" className="text-[15px] font-semibold text-ink">
          Career-site key
        </h2>
        <p className="mt-1 text-[14px] text-ink-muted">
          {view.masked ? (
            <>
              <span className="font-mono text-ink">{view.masked}</span>
              {view.source === "environment" ? " · from the server's environment (save one here to replace it)" : view.updatedAt ? ` · saved ${new Date(view.updatedAt).toLocaleString()}` : ""}
            </>
          ) : (
            "None saved. The Careers page says it isn't set up yet."
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" loading={busy === "test"} onClick={() => void test()}>
            Test connection
          </Button>
          {view.source === "database" ? (
            <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => setAsking(true)}>
              Clear key
            </Button>
          ) : null}
        </div>
      </section>

      <form onSubmit={save} className="space-y-3 rounded-2xl border border-border-soft bg-surface/90 p-4">
        <Field
          label={view.source === "database" ? "Replace the key" : "Paste the key"}
          htmlFor="careers-key"
          hint="From WonderJobs › Hiring › Jobs › Career sites › Add a career site › On our own website. It starts with wjcs_ and is shown there only once."
          error={error}
        >
          <Input id="careers-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder="wjcs_…" aria-describedby={error ? "careers-key-error" : "careers-key-hint"} />
        </Field>
        <Button type="submit" loading={busy === "save"} disabled={!key.trim()}>
          Save key
        </Button>
      </form>
      <p role="status" aria-live="polite" className="min-h-5 text-[14px] text-ink">
        {line}
      </p>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        destructive
        busy={busy === "clear"}
        title="Clear the career-site key?"
        body="The Careers page will say it isn't set up until a key is saved again (or the server's fallback key is used)."
        confirmLabel="Clear key"
        onConfirm={() => void clear()}
      />
    </div>
  );
}
