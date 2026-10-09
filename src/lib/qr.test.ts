import { describe, expect, it } from "vitest";
import { parseAssetCode } from "./qr";

const id = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

describe("parseAssetCode", () => {
  it("reads label URLs from any host", () => {
    expect(parseAssetCode(`https://assetcareconnect.app/assets/${id}`)).toBe(id);
    expect(parseAssetCode(`https://old.example.com/assets/${id}/`)).toBe(id);
    expect(parseAssetCode(`https://x.test/assets/${id}?ref=label#top`)).toBe(id);
  });
  it("reads relative paths and bare ids", () => {
    expect(parseAssetCode(`/assets/${id}`)).toBe(id);
    expect(parseAssetCode(` ${id.toUpperCase()} `)).toBe(id);
  });
  it("rejects anything else", () => {
    expect(parseAssetCode("")).toBeNull();
    expect(parseAssetCode("hello")).toBeNull();
    expect(parseAssetCode("https://x.test/assets/capture")).toBeNull();
    expect(parseAssetCode(`https://x.test/other/${id}`)).toBeNull();
    expect(parseAssetCode(`https://x.test/assets/${id}/extra`)).toBeNull();
  });
});
