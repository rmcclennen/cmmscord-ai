import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "./push-endpoints";

describe("isAllowedPushEndpoint", () => {
  it("accepts the real push services", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(
      true,
    );
    expect(isAllowedPushEndpoint("https://web.push.apple.com/Qx")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=1")).toBe(true);
  });
  it("rejects everything else", () => {
    for (const bad of [
      "http://fcm.googleapis.com/x",
      "https://evil.example.com/",
      "https://169.254.169.254/latest",
      "https://fcm.googleapis.com.evil.com/x",
      "https://user:pw@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://localhost/",
      "not a url",
    ]) {
      expect(isAllowedPushEndpoint(bad)).toBe(false);
    }
  });
});
