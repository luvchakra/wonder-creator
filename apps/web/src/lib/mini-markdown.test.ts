import { describe, expect, it } from "vitest";
import { domToMd, mdToHtml, type MdNode } from "./mini-markdown";

const txt = (s: string): MdNode => ({ nodeType: 3, nodeName: "#text", textContent: s, childNodes: [] });
const el = (name: string, ...kids: MdNode[]): MdNode => ({ nodeType: 1, nodeName: name.toUpperCase(), textContent: null, childNodes: kids });

describe("mdToHtml", () => {
  it("shows bold, italic and lists, one div per line", () => {
    expect(mdToHtml("a **b** _c_\n\n- one\n- two\nend")).toBe("<div>a <b>b</b> <i>c</i></div><div><br></div><ul><li>one</li><li>two</li></ul><div>end</div>");
  });
  it("never turns text into markup", () => {
    expect(mdToHtml("<img src=x onerror=alert(1)> **<b>**")).toBe("<div>&lt;img src=x onerror=alert(1)&gt; <b>&lt;b&gt;</b></div>");
  });
  it("leaves snake_case and lone markers alone, and honours escapes", () => {
    expect(mdToHtml("my_var_name 2 * 3 \\*not bold\\*")).toBe("<div>my_var_name 2 * 3 *not bold*</div>");
  });
});

describe("domToMd", () => {
  it("turns the editor's markup back into text with markers", () => {
    const root = el("div", el("div", txt("a "), el("b", txt("b")), txt(" "), el("i", txt("c"))), el("div", el("br")), el("ul", el("li", txt("one")), el("li", txt("two"))), el("div", txt("end")));
    expect(domToMd(root)).toBe("a **b** _c_\n\n- one\n- two\nend");
  });
  it("reads loose text and <br> lines (a plain first line)", () => {
    expect(domToMd(el("div", txt("hello"), el("br"), txt("there")))).toBe("hello\nthere");
  });
  it("escapes characters that would be read as markers", () => {
    expect(domToMd(el("div", txt("2 * 3 and my_var and _x_")))).toBe("2 \\* 3 and my_var and \\_x\\_");
  });
  it("round-trips", () => {
    const md = "**Bold** start\n- a\n- b\n\n_end_ of it";
    const root = el("div", el("div", el("b", txt("Bold")), txt(" start")), el("ul", el("li", txt("a")), el("li", txt("b"))), el("div", el("br")), el("div", el("i", txt("end")), txt(" of it")));
    expect(domToMd(root)).toBe(md);
  });
  it("drops empty bold/italic", () => {
    expect(domToMd(el("div", el("div", el("b", txt("")), txt("x"))))).toBe("x");
  });
});
