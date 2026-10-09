import { generateKeyPairSync, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildPushPayload } from "@block65/webcrypto-web-push";

// Builds keys in the same format scripts/generate-vapid-keys.mjs prints and a browser sends.
function vapid() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "jwk" });
  const priv = privateKey.export({ format: "jwk" });
  const raw = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(pub.x!, "base64url"),
    Buffer.from(pub.y!, "base64url"),
  ]);
  return { publicKey: raw.toString("base64url"), privateKey: priv.d!, subject: "mailto:a@b.test" };
}

describe("web push payload", () => {
  it("builds an encrypted, signed request for a browser subscription", async () => {
    const browser = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({
      format: "jwk",
    });
    const p256dh = Buffer.concat([
      Buffer.from([4]),
      Buffer.from(browser.x!, "base64url"),
      Buffer.from(browser.y!, "base64url"),
    ]).toString("base64url");
    const payload = await buildPushPayload(
      { data: JSON.stringify({ title: "WO assigned" }), options: { ttl: 60 } },
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        expirationTime: null,
        keys: { p256dh, auth: randomBytes(16).toString("base64url") },
      },
      vapid(),
    );
    const headers = new Headers(payload.headers);
    expect(payload.method.toUpperCase()).toBe("POST");
    expect(headers.get("content-encoding")).toBe("aes128gcm");
    expect(headers.get("authorization")).toMatch(/^vapid /);
    expect(headers.get("ttl")).toBe("60");
    expect((payload.body as Uint8Array).byteLength).toBeGreaterThan(100);
  });
});
