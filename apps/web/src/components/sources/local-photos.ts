"use client";

/**
 * Photos the creator selected on this device (Personal Sources phase D). Everything here runs in the browser: the
 * SHA-256 of each original, when it was taken (EXIF DateTimeOriginal, else the file's date), and a tiny thumbnail.
 * Only that leaves the device during discovery. The originals stay in memory for this visit, so a chosen photo can be
 * brought in at full quality without picking it again.
 */

const originals = new Map<string, File>();
export const localOriginal = (sha: string) => originals.get(sha) ?? null;
export const rememberOriginal = (sha: string, f: File) => void originals.set(sha, f);

export interface LocalPhoto {
  sha256: string;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  thumb: string;
}

export async function sha256Hex(f: Blob): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Read one photo: fingerprint, date, size and a ≤12 KB thumbnail. Null when the browser can't decode it. */
export async function readPhoto(f: File): Promise<LocalPhoto | null> {
  if (!f.type.startsWith("image/")) return null;
  const sha256 = await sha256Hex(f);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(f);
  } catch {
    return null;
  }
  const thumb = await thumbnail(bitmap);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  if (!thumb) return null;
  const out: LocalPhoto = { sha256, takenAt: (await exifDate(f)) ?? new Date(f.lastModified).toISOString(), ...size, thumb };
  rememberOriginal(sha256, f);
  return out;
}

async function thumbnail(b: ImageBitmap): Promise<string | null> {
  for (const [side, q] of [
    [176, 0.62],
    [144, 0.5],
    [112, 0.42],
  ] as const) {
    const scale = Math.min(1, side / Math.max(b.width, b.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(b.width * scale));
    canvas.height = Math.max(1, Math.round(b.height * scale));
    canvas.getContext("2d")!.drawImage(b, 0, 0, canvas.width, canvas.height);
    const uri = canvas.toDataURL("image/jpeg", q);
    // ~12 KB of bytes once decoded from base64.
    if (uri.length <= 16_000) return uri;
  }
  return null;
}

/** EXIF DateTimeOriginal from a JPEG, read from its first 128 KB. Local time as written by the camera. */
export async function exifDate(f: Blob): Promise<string | null> {
  const buf = new DataView(await f.slice(0, 128 * 1024).arrayBuffer());
  if (buf.byteLength < 4 || buf.getUint16(0) !== 0xffd8) return null;
  let off = 2;
  while (off + 4 <= buf.byteLength) {
    const marker = buf.getUint16(off);
    const len = buf.getUint16(off + 2);
    if (marker === 0xffe1 && off + 10 <= buf.byteLength && buf.getUint32(off + 4) === 0x45786966) return readTiff(buf, off + 10, len - 8);
    if ((marker & 0xff00) !== 0xff00 || len < 2) return null;
    off += 2 + len;
  }
  return null;
}

function readTiff(v: DataView, start: number, size: number): string | null {
  const end = Math.min(v.byteLength, start + size);
  if (start + 8 > end) return null;
  const le = v.getUint16(start) === 0x4949;
  const u16 = (o: number) => v.getUint16(start + o, le);
  const u32 = (o: number) => v.getUint32(start + o, le);
  const ifd = (o: number, tag: number): number | null => {
    if (start + o + 2 > end) return null;
    const n = u16(o);
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12;
      if (start + e + 12 > end) return null;
      if (u16(e) === tag) return u32(e + 8);
    }
    return null;
  };
  const exif = ifd(u32(4), 0x8769);
  const at = exif !== null ? ifd(exif, 0x9003) : ifd(u32(4), 0x0132);
  if (at === null || start + at + 19 > end) return null;
  let s = "";
  for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(start + at + i));
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
