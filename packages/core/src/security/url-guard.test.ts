import { describe, expect, it } from "vitest";
import { assertPublicHost, isPrivateAddress, parseExternalUrl, safeFetch } from "./url-guard";

describe("parseExternalUrl", () => {
  it("accepts ordinary https links", () => {
    expect(parseExternalUrl("https://example.com/a?b=1").hostname).toBe("example.com");
  });
  it.each([
    "file:///etc/passwd",
    "ftp://example.com/x",
    "javascript:alert(1)",
    "gopher://example.com",
    "http://user:pass@example.com",
    "http://example.com:8080/",
    "http://localhost/admin",
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://10.1.2.3/",
    "http://192.168.1.1/",
    "http://metadata.google.internal/",
    "http://printer.local/",
  ])("rejects %s", (raw) => {
    expect(() => parseExternalUrl(raw)).toThrow();
  });
  it("rejects garbage", () => {
    expect(() => parseExternalUrl("not a url")).toThrow(/doesn't look like a link/);
  });
});

describe("isPrivateAddress", () => {
  it.each(["10.0.0.1", "172.20.1.1", "192.168.0.10", "127.0.0.1", "0.0.0.0", "100.64.1.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1"])(
    "%s is private",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])("%s is public", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("assertPublicHost (DNS rebinding defence)", () => {
  it("rejects a hostname that resolves to a private address", async () => {
    await expect(assertPublicHost(new URL("https://evil.example"), async () => ["10.0.0.5"])).rejects.toThrow(/private network/);
  });
  it("rejects when any record is private", async () => {
    await expect(assertPublicHost(new URL("https://mixed.example"), async () => ["8.8.8.8", "127.0.0.1"])).rejects.toThrow();
  });
  it("accepts public records", async () => {
    await expect(assertPublicHost(new URL("https://ok.example"), async () => ["93.184.216.34"])).resolves.toBeUndefined();
  });
});

describe("safeFetch", () => {
  const publicResolver = async () => ["93.184.216.34"];
  it("re-validates redirects and refuses a redirect into a private network", async () => {
    const fetchImpl = (async () =>
      new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } })) as unknown as typeof fetch;
    await expect(safeFetch("https://example.com", { resolve: publicResolver, fetchImpl })).rejects.toThrow(/private network/);
  });
  it("caps the body size", async () => {
    const fetchImpl = (async () => new Response("x".repeat(5000), { headers: { "content-type": "text/plain" } })) as unknown as typeof fetch;
    const res = await safeFetch("https://example.com", { resolve: publicResolver, fetchImpl, maxBytes: 1000 });
    expect(res.body.byteLength).toBe(1000);
    expect(res.truncated).toBe(true);
  });
  it("stops after too many redirects", async () => {
    const fetchImpl = (async () => new Response(null, { status: 301, headers: { location: "https://example.com/again" } })) as unknown as typeof fetch;
    await expect(safeFetch("https://example.com", { resolve: publicResolver, fetchImpl, maxRedirects: 2 })).rejects.toThrow(/too many/);
  });
  it("POSTs a body with headers and never follows a redirect", async () => {
    const seen: RequestInit[] = [];
    const ok = (async (_u: URL, init: RequestInit) => (seen.push(init), new Response("{}", { status: 200 }))) as unknown as typeof fetch;
    await safeFetch("https://example.com/hook", { resolve: publicResolver, fetchImpl: ok, method: "POST", body: '{"a":1}', headers: { "x-test": "1" } });
    expect(seen[0]).toMatchObject({ method: "POST", body: '{"a":1}', redirect: "manual" });
    expect((seen[0].headers as Record<string, string>)["x-test"]).toBe("1");
    const moved = (async () => new Response(null, { status: 307, headers: { location: "https://example.com/elsewhere" } })) as unknown as typeof fetch;
    await expect(safeFetch("https://example.com/hook", { resolve: publicResolver, fetchImpl: moved, method: "POST", body: "{}" })).rejects.toThrow(/redirected/);
    await expect(safeFetch("https://10.0.0.1/hook", { resolve: publicResolver, fetchImpl: ok, method: "POST", body: "{}" })).rejects.toThrow();
  });
});
