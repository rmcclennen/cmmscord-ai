import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPublicHttpUrl, isPrivateIPv4, isPrivateIPv6, safeFetch } from "./url-guard";

describe("assertPublicHttpUrl", () => {
  it("accepts ordinary public links", () => {
    expect(assertPublicHttpUrl("https://www.grainger.com/product/abc.pdf").hostname).toBe(
      "www.grainger.com",
    );
    expect(assertPublicHttpUrl("http://example.org:80/a").port).toBe("");
  });

  it.each([
    "ftp://example.com/a.pdf",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://user:pass@example.com/",
    "https://example.com:8443/",
    "http://localhost/admin",
    "http://app.localhost/",
    "http://printer.local/",
    "http://metadata.google.internal/",
    "http://intranet/",
    "http://127.0.0.1/",
    "http://2130706433/", // decimal form of 127.0.0.1
    "http://0x7f.0.0.1/",
    "http://10.1.2.3/",
    "http://172.16.0.5/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:127.0.0.1]/",
    "not a url",
  ])("rejects %s", (u) => {
    expect(() => assertPublicHttpUrl(u)).toThrow();
  });
});

describe("ip helpers", () => {
  it("classifies IPv4", () => {
    expect(isPrivateIPv4("8.8.8.8")).toBe(false);
    expect(isPrivateIPv4("172.32.0.1")).toBe(false);
    expect(isPrivateIPv4("172.31.255.255")).toBe(true);
    expect(isPrivateIPv4("100.64.0.1")).toBe(true);
  });
  it("classifies IPv6", () => {
    expect(isPrivateIPv6("2606:4700::1111")).toBe(false);
    expect(isPrivateIPv6("::ffff:7f00:1")).toBe(true);
  });
});

describe("safeFetch", () => {
  afterEach(() => vi.restoreAllMocks());

  it("re-validates redirects so a public URL can't bounce to an internal one", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }),
      );
    await expect(safeFetch("https://example.com/redirect")).rejects.toThrow(/private or internal/);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("follows safe redirects", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, { status: 301, headers: { location: "/final.pdf" } }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const res = await safeFetch("https://example.com/a");
    expect(await res.text()).toBe("ok");
  });

  it("stops after too many redirects", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(null, { status: 302, headers: { location: "https://example.com/x" } }),
    );
    await expect(safeFetch("https://example.com/x", {}, { maxRedirects: 2 })).rejects.toThrow(
      /too many times/,
    );
  });

  it("allows the app's own origin even on localhost", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("file", { status: 200 }));
    const res = await safeFetch(
      "http://localhost:3000/files/a.pdf",
      {},
      {
        allowOrigin: "http://localhost:3000",
      },
    );
    expect(res.ok).toBe(true);
  });
});
