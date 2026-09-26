import "server-only";
import { DomainError } from "@wonder/core";
import { EXPORT_FORMATS, exportFormatsFor, renderExport, type ExportFormat, type SharedPiece } from "@wonder/creator-studio";

/** A download of a shared piece: only when the owner allowed it, only in formats that suit it. */
export function sharedDownload(piece: SharedPiece, format: string | null): Response {
  if (!piece.allowDownload) throw new DomainError("forbidden", "The creator hasn't allowed downloads of this piece.");
  const allowed = exportFormatsFor(piece.artifactType);
  const asked = (format ?? allowed[0]) as ExportFormat;
  if (!(asked in EXPORT_FORMATS) || !allowed.includes(asked)) throw new DomainError("validation", "That format isn't available for this kind of piece.");
  const out = renderExport(asked, {
    title: piece.title,
    artifactType: piece.artifactType,
    versionNumber: piece.versionNumber ?? 1,
    createdAt: piece.versionCreatedAt ?? piece.sharedAt,
    content: piece.content,
    byline: piece.creatorName,
  });
  return new Response(out.body, {
    headers: { "content-type": out.contentType, "content-disposition": `attachment; filename="${out.filename}"`, "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}
