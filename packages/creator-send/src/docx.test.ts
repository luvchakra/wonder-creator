import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extractDocxText } from "./docx";

const docx = (body: string, extra: Record<string, Uint8Array> = {}) =>
  zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "word/document.xml": strToU8(`<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${body}</w:body></w:document>`),
    ...extra,
  });

describe("extractDocxText", () => {
  it("reads paragraphs, runs, tabs, breaks and entities", () => {
    const body =
      '<w:p><w:r><w:t>Salt &amp; light</w:t></w:r><w:r><w:t xml:space="preserve"> on the ghats</w:t></w:r></w:p>' +
      "<w:p><w:r><w:t>Line one</w:t><w:br/><w:t>Line two</w:t><w:tab/><w:t>&#8212;end&#x21;</w:t></w:r></w:p>";
    expect(extractDocxText(docx(body))).toBe("Salt & light on the ghats\nLine one\nLine two\t—end!");
  });

  it("returns an empty string for a document without text", () => {
    expect(extractDocxText(docx("<w:p/>"))).toBe("");
  });

  it("returns null for non-zip input or a zip without a Word document", () => {
    expect(extractDocxText(strToU8("not a zip"))).toBeNull();
    expect(extractDocxText(zipSync({ "hello.txt": strToU8("hi") }))).toBeNull();
  });

  it("only decompresses the main document part", () => {
    const huge = new Uint8Array(30 * 1024 * 1024);
    expect(extractDocxText(docx("<w:p><w:r><w:t>ok</w:t></w:r></w:p>", { "word/media/big.bin": huge }))).toBe("ok");
  });
});
