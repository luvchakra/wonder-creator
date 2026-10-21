/**
 * The small formatting a quick note allows (owner, 21 Oct 2026: "minor wysiwyg"): **bold**, _italic_ and "- " lists.
 * A note is still plain text underneath, so everything that reads it (the first draft of a Creation, search, a
 * transcript view) stays readable: the markers are the whole format. `mdToHtml` is what the editor shows;
 * `domToMd` turns the editor's markup back. Text is always escaped, never trusted as markup.
 */

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inlineHtml(line: string): string {
  // Backslash escapes (\* \_ \\) become placeholders so they aren't read as markers, then come back as characters.
  const kept: string[] = [];
  let s = line.replace(/\\([\\*_])/g, (_, c: string) => `\u0000${kept.push(c) - 1}\u0000`);
  s = escapeHtml(s);
  s = s.replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<b>$1</b>");
  s = s.replace(/(^|[\s(>])_(?=\S)(.+?)(?<=\S)_(?=$|[\s).,!?;:<])/g, "$1<i>$2</i>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => escapeHtml(kept[Number(i)] ?? ""));
}

/** Markdown-ish text → the editor's HTML: a `div` per line, a `ul` for runs of "- " lines. */
export function mdToHtml(md: string): string {
  const out: string[] = [];
  let list: string[] | null = null;
  const closeList = () => {
    if (list) out.push(`<ul>${list.join("")}</ul>`);
    list = null;
  };
  for (const line of md.split("\n")) {
    const item = /^- (.*)$/.exec(line);
    if (item) {
      (list ??= []).push(`<li>${inlineHtml(item[1] ?? "")}</li>`);
      continue;
    }
    closeList();
    out.push(line ? `<div>${inlineHtml(line)}</div>` : "<div><br></div>");
  }
  closeList();
  return out.join("");
}

/** The few parts of a DOM node this needs, so it can be tested without a browser. */
export interface MdNode {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: ArrayLike<MdNode>;
}

const escapeText = (t: string) => t.replace(/[\\*]/g, "\\$&").replace(/(^|\s)_|_(?=\s|$)/g, (m) => m.replace("_", "\\_"));

function inline(node: MdNode): string {
  if (node.nodeType === 3) return escapeText(node.textContent ?? "");
  if (node.nodeType !== 1) return "";
  const name = node.nodeName.toLowerCase();
  if (name === "br") return "\n";
  const inner = Array.from(node.childNodes, inline).join("");
  if (!inner.trim()) return inner;
  if (name === "b" || name === "strong") return `**${inner}**`;
  if (name === "i" || name === "em") return `_${inner}_`;
  return inner;
}

/** The editor's markup → text with markers. Blocks (`div`, `p`, `li`) become lines; `ul`/`ol` items get "- ". */
export function domToMd(root: MdNode): string {
  const lines: string[] = [];
  const block = (node: MdNode, prefix = "") => {
    const name = node.nodeName.toLowerCase();
    if (node.nodeType === 3) {
      const t = inline(node);
      if (t.trim() || !lines.length || t) lines.push(...t.split("\n").map((l, i) => (i === 0 ? prefix : "") + l));
      return;
    }
    if (name === "ul" || name === "ol") {
      for (const li of Array.from(node.childNodes)) block(li, "- ");
      return;
    }
    if (name === "div" || name === "p" || name === "li") {
      const kids = Array.from(node.childNodes);
      const nested = kids.some((k) => ["ul", "ol", "div", "p"].includes(k.nodeName.toLowerCase()));
      if (nested) {
        for (const k of kids) block(k, prefix);
        return;
      }
      const text = kids.map(inline).join("");
      const parts = text === "\n" ? [""] : text.split("\n");
      parts.forEach((l, i) => lines.push((i === 0 ? prefix : "") + l));
      return;
    }
    const t = inline(node);
    if (t) lines.push(...t.split("\n"));
  };
  // Loose text and inline tags straight under the root form one line until the next block.
  let loose: MdNode[] = [];
  const flush = () => {
    if (!loose.length) return;
    const text = loose.map(inline).join("");
    lines.push(...text.split("\n"));
    loose = [];
  };
  for (const child of Array.from(root.childNodes)) {
    const n = child.nodeName.toLowerCase();
    if (["div", "p", "ul", "ol"].includes(n)) {
      flush();
      block(child);
    } else loose.push(child);
  }
  flush();
  return lines.join("\n").replace(/\n+$/, "");
}
