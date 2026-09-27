import { EXPORT_FORMATS, exportFormatsFor, exportNote } from "@wonder/creator-studio/exports";
import { artifactType } from "@wonder/creator-studio/types";
import type { SharedPiece } from "@wonder/creator-studio";
import { buttonClasses } from "@wonder/ui";
import { Download } from "lucide-react";

/** A shared piece: its title, creator and text, and downloads when allowed. Nothing about its sources. */
export function SharedPieceView({ piece, downloadBase, compact }: { piece: SharedPiece; downloadBase: string | null; compact?: boolean }) {
  const note = exportNote(piece.artifactType);
  return (
    <article className={compact ? "p-5" : "mx-auto max-w-2xl"}>
      <p className="text-sm text-ink-muted">
        {artifactType(piece.artifactType).label}
        {piece.pinned && piece.versionNumber ? ` · version ${piece.versionNumber}` : ""}
      </p>
      <h1 className={compact ? "mt-1 font-display text-2xl text-ink" : "mt-1 font-display text-[28px] leading-tight text-ink sm:text-4xl"}>{piece.title}</h1>
      <p className="mt-1 text-[15px] text-ink-muted">by {piece.creatorName}</p>
      <div className="mt-6 whitespace-pre-wrap font-display text-[17px] leading-[1.8] text-ink">{piece.content || "This Creation is empty."}</div>
      {downloadBase && piece.allowDownload ? (
        <div className="mt-8 border-t border-border-soft pt-5">
          <h2 className="text-sm font-semibold text-ink">Download</h2>
          {note ? <p className="mt-1 text-sm text-ink-muted">{note}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {exportFormatsFor(piece.artifactType).map((f) => (
              <a key={f} href={`${downloadBase}?format=${f}`} rel="noreferrer" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <Download className="size-4" aria-hidden /> {EXPORT_FORMATS[f].label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
