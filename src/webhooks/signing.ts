import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "t=";
const V1 = "v1=";

/**
 * Build `t=<unix>,v1=<hex>` signature header value (Stripe-style: HMAC-SHA256 of `t.body`).
 */
export function signOutgoingWebhook(secret: string, body: string): {
  timestamp: string;
  signatureHeader: string;
} {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signed = `${timestamp}.${body}`;
  const v1 = createHmac("sha256", secret).update(signed, "utf8").digest("hex");
  return {
    timestamp,
    signatureHeader: `${PREFIX}${timestamp},${V1}${v1}`,
  };
}

/**
 * Verify a request your app receives from the payment service (optional helper).
 */
export function verifyOutgoingWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) {
    return false;
  }
  let t = "";
  let v1 = "";
  for (const part of signatureHeader.split(",")) {
    const p = part.trim();
    if (p.startsWith(PREFIX)) {
      t = p.slice(PREFIX.length);
    } else if (p.startsWith(V1)) {
      v1 = p.slice(V1.length);
    }
  }
  if (!t || !v1) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
