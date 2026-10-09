import { describe, expect, it } from "vitest";
import { isIosDevice, isPreviewHost, shouldRegisterServiceWorker } from "./pwa";

const base = { dev: false, hostname: "plant.example.com", inIframe: false, hasServiceWorker: true };

describe("shouldRegisterServiceWorker", () => {
  it("registers on a normal production site", () => {
    expect(shouldRegisterServiceWorker(base)).toBe(true);
  });
  it("skips dev, iframes, unsupported browsers and editor previews", () => {
    expect(shouldRegisterServiceWorker({ ...base, dev: true })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...base, inIframe: true })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...base, hasServiceWorker: false })).toBe(false);
    expect(
      shouldRegisterServiceWorker({ ...base, hostname: "id-preview--abc123.lovable.app" }),
    ).toBe(false);
    expect(shouldRegisterServiceWorker({ ...base, hostname: "abc.lovableproject.com" })).toBe(
      false,
    );
  });
});

describe("isPreviewHost", () => {
  it("recognises preview hosts only", () => {
    expect(isPreviewHost("id-preview--x.lovable.app")).toBe(true);
    expect(isPreviewHost("cmmscord-ai.lovable.app")).toBe(false);
    expect(isPreviewHost("assetcareconnect.app")).toBe(false);
  });
});

describe("isIosDevice", () => {
  it("detects iPhone, iPad and desktop-class iPadOS", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(isIosDevice("Mozilla/5.0 (Linux; Android 14)")).toBe(false);
  });
});
