"use client";
import { Button, Dialog, DialogContent, Field, Input } from "@wonder/ui";
import { useRef, useState } from "react";
import { ApiError, errorMessage } from "@/lib/client";

type Pending = { message: string; retry: (password: string) => Promise<void>; resolve: () => void; reject: (e: unknown) => void };

/**
 * Step-up authentication for high-impact actions. `run(fn)` calls `fn()` first; if the server answers
 * `step_up_required`, it asks for the creator's password and retries with it. Render `dialog` once.
 */
export function useStepUp() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function run(fn: (password?: string) => Promise<void>): Promise<void> {
    return fn().catch((e) => {
      if (!(e instanceof ApiError && e.code === "step_up_required")) throw e;
      return new Promise<void>((resolve, reject) => {
        setPassword("");
        setError(null);
        setPending({ message: e.message, retry: (pw) => fn(pw), resolve, reject });
      });
    });
  }

  function close(reason?: unknown) {
    pending?.reject(reason ?? new Error("Cancelled."));
    setPending(null);
  }

  const dialog = (
    <Dialog open={!!pending} onOpenChange={(o) => (!o ? close() : undefined)}>
      <DialogContent title="Confirm it's you" description={pending?.message ?? ""}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!pending || !password) return;
            setBusy(true);
            setError(null);
            try {
              await pending.retry(password);
              pending.resolve();
              setPending(null);
            } catch (err) {
              if (err instanceof ApiError && err.code === "step_up_required") {
                setError(err.message);
                inputRef.current?.focus();
              } else {
                close(err);
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Password" htmlFor="step-up-password" error={error ?? undefined}>
            <Input ref={inputRef} id="step-up-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => close()}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!password}>
              Confirm
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { run, dialog };
}

/** Cancelling the password prompt isn't an error worth showing. */
export function stepUpErrorMessage(e: unknown): string | null {
  return e instanceof Error && e.message === "Cancelled." ? null : errorMessage(e);
}
