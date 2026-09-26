import { describe, expect, it } from "vitest";
import { inspectUpload, safeFilename, SIZE_LIMITS } from "./uploads";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

describe("inspectUpload", () => {
  it("detects PNG by content regardless of name", async () => {
    const r = await inspectUpload(PNG, "holiday.pdf");
    expect(r.mime).toBe("image/png");
    expect(r.kind).toBe("image");
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("detects PDF", async () => {
    expect((await inspectUpload(PDF, "x.bin")).kind).toBe("pdf");
  });
  it("accepts UTF-8 text", async () => {
    const r = await inspectUpload(new TextEncoder().encode("A note about my father's house."), "note.md");
    expect(r.mime).toBe("text/markdown");
  });
  it("rejects executables disguised as images", async () => {
    const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0x3e, 0]);
    await expect(inspectUpload(elf, "photo.jpg")).rejects.toMatchObject({ code: "unsupported_media" });
  });
  it("rejects binary junk with NUL bytes", async () => {
    await expect(inspectUpload(new Uint8Array([1, 0, 2, 0, 3]), "a.txt")).rejects.toMatchObject({ code: "unsupported_media" });
  });
  it("rejects empty files", async () => {
    await expect(inspectUpload(new Uint8Array(), "a.txt")).rejects.toMatchObject({ code: "validation" });
  });
  it("enforces per-kind size limits", async () => {
    const big = new Uint8Array(SIZE_LIMITS.text + 10).fill(0x61);
    await expect(inspectUpload(big, "a.txt")).rejects.toMatchObject({ code: "payload_too_large" });
  });
});

describe("safeFilename", () => {
  it("strips paths and control characters", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\Users\\me\\a\u0000b.png")).toBe("ab.png");
    expect(safeFilename("")).toBeNull();
  });
});
