"use client";
import { TEMPLATE_IDS, TEMPLATE_INFO, TEMPLATE_SETTINGS, settingsFor, type CreatorPageTemplateId, type TemplateSettings } from "@wonder/creator-studio/creator-page";
import { Button, KitArt, Segmented, Switch, cn } from "@wonder/ui";
import { Check, Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TEMPLATE_THUMB } from "@/components/creator-page/assets";
import { CreatorPageView } from "@/components/creator-page/registry";
import { api, errorMessage } from "@/lib/client";
import type { PublicCreatorPage } from "@/lib/public-pages";

const DESKTOP = 1024;

/**
 * Appearance (spec §20–§23): choose how the page is expressed. Picking a card only previews it — with the creator's
 * real public content, in a phone or desktop frame — until "Use this template". Each template keeps its own settings,
 * and only the settings that template offers are shown. Changing a setting saves it; the preview follows at once.
 */
export function Appearance({ preview, initialTemplate, initialSettings }: { preview: PublicCreatorPage | null; initialTemplate: CreatorPageTemplateId; initialSettings: Record<string, TemplateSettings> }) {
  const [current, setCurrent] = useState(initialTemplate);
  const [shown, setShown] = useState<CreatorPageTemplateId>(initialTemplate);
  const [all, setAll] = useState(initialSettings);
  const [viewport, setViewport] = useState<"mobile" | "desktop">("mobile");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setZoom(Math.min(1, (e?.contentRect.width ?? DESKTOP) / DESKTOP)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const settings = settingsFor(shown, all);

  async function use() {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/v1/creator-page", { method: "PATCH", json: { templateId: shown } });
      setCurrent(shown);
      setMsg(`Your page now uses ${TEMPLATE_INFO[shown].name}. The address stays the same.`);
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function change(key: string, value: string | boolean) {
    const next = { ...all, [shown]: { ...settings, [key]: value } };
    setAll(next);
    try {
      await api("/api/v1/creator-page", { method: "PATCH", json: { templateSettings: { template: shown, settings: { [key]: value } } } });
    } catch (e) {
      setMsg(errorMessage(e));
    }
  }

  return (
    <section aria-label="Appearance" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Appearance</h2>
        <p className="text-[12.5px] text-ink-subtle">
          Current: <span className="font-medium text-ink">{TEMPLATE_INFO[current].name}</span>
        </p>
      </div>
      <ul role="list" aria-label="Choose your Creator Page style" className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0">
        {TEMPLATE_IDS.map((id) => (
          <li key={id} className="w-36 shrink-0 snap-start sm:w-auto">
            <button
              type="button"
              aria-pressed={shown === id}
              aria-label={`Preview ${TEMPLATE_INFO[id].name}${current === id ? " (in use)" : ""}`}
              onClick={() => setShown(id)}
              className={cn("group block w-full rounded-2xl border bg-surface p-1.5 text-left transition-colors", shown === id ? "border-accent ring-2 ring-accent/30" : "border-border-soft hover:border-accent/40")}
            >
              <span className="relative block aspect-[3/4] overflow-hidden rounded-xl">
                <KitArt art={TEMPLATE_THUMB[id]} sizes="10rem" className="size-full object-cover" />
                {current === id ? (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-accent-ink">
                    <Check className="size-3" aria-hidden /> In use
                  </span>
                ) : null}
              </span>
              <span className="mt-1.5 block px-1 text-[13px] font-medium text-ink">{TEMPLATE_INFO[id].name}</span>
              <span className="block px-1 pb-0.5 text-[11.5px] text-ink-subtle">{TEMPLATE_INFO[id].description}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-border-soft bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted">
            <Eye className="size-4" aria-hidden /> Preview · {TEMPLATE_INFO[shown].name}
          </p>
          <Segmented
            label="Preview size"
            value={viewport}
            options={[
              { value: "mobile", label: "Mobile" },
              { value: "desktop", label: "Desktop" },
            ]}
            onChange={setViewport}
          />
        </div>
        <div ref={frame} className="mt-3">
          {preview ? (
            <div role="img" aria-label={`Preview of your page in ${TEMPLATE_INFO[shown].name}`} className={cn("mx-auto overflow-y-auto overscroll-contain rounded-2xl border border-border-soft bg-cream", viewport === "mobile" ? "h-[36rem] w-full max-w-[390px]" : "h-[34rem] w-full")}>
              <div inert style={viewport === "desktop" ? { width: DESKTOP, zoom } : undefined}>
                <CreatorPageView data={preview} mode="preview" templateId={shown} settings={settings} />
              </div>
            </div>
          ) : (
            <p className="text-[13.5px] text-ink-muted">Save your page once to see it here.</p>
          )}
        </div>
        {TEMPLATE_SETTINGS[shown].length ? (
          <div aria-label={`${TEMPLATE_INFO[shown].name} settings`} role="group" className="mt-3 divide-y divide-border-soft border-t border-border-soft">
            {TEMPLATE_SETTINGS[shown].map((f) =>
              f.kind === "toggle" ? (
                <label key={f.key} className="flex min-h-12 items-center justify-between gap-3 text-[14px] text-ink">
                  {f.label}
                  <Switch checked={settings[f.key] === true} onCheckedChange={(v) => void change(f.key, v)} label={f.label} />
                </label>
              ) : (
                <div key={f.key} className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-1 text-[14px] text-ink">
                  <span>{f.label}</span>
                  <Segmented label={f.label} value={String(settings[f.key])} options={f.options} onChange={(v) => void change(f.key, v)} />
                </div>
              ),
            )}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          {msg ? (
            <p role="status" className="mr-auto text-[13px] text-ink-muted">
              {msg}
            </p>
          ) : null}
          {shown !== current ? (
            <Button loading={busy} onClick={() => void use()}>
              Use this template
            </Button>
          ) : (
            <span className="text-[12.5px] text-ink-subtle">This is your page&rsquo;s current look.</span>
          )}
        </div>
      </div>
    </section>
  );
}
