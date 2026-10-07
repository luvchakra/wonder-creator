"use client";

/**
 * A photo made small enough to send before it leaves the phone (owner, 7 Oct 2026: "when i try to add photos in my album,
 * it just throws error"). Phone photos are 4–10 MB; the host refuses request bodies over about 4.5 MB before the app
 * even sees them. The album, avatars and community pictures keep at most 2048 px, so a 2560 px copy loses nothing that
 * shows — and re-drawing it drops the photo's metadata (location included) here, before upload; the server still
 * checks, resizes and strips as before. Turned the right way up from its EXIF orientation. Anything that can't be
 * decoded here (or would come out larger) is sent as it was.
 */
const SMALL_ENOUGH = 1.5 * 1024 * 1024;
/** What the host accepts in one request, with room for the form around the file. */
export const MAX_SEND_BYTES = 4 * 1024 * 1024;

export async function shrinkImage(file: File, maxEdge = 2560): Promise<File> {
  if (!file.type.startsWith("image/") || /gif|svg/.test(file.type) || file.size <= SMALL_ENOUGH) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    // PNGs may be see-through: keep that (WebP); photos become JPEG.
    const type = file.type === "image/png" ? "image/webp" : "image/jpeg";
    let blob: Blob | null;
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
      blob = await canvas.convertToBlob({ type, quality: 0.9 });
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    }
    bmp.close();
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.${ext}`, { type: blob.type || type });
  } catch {
    return file;
  }
}

/** A readable reason for a failed upload, including the host's own "too large" (which isn't JSON). */
export async function uploadError(res: Response, fallback: string): Promise<string> {
  if (res.status === 413) return "That picture is too large to send. Try a smaller one.";
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}
