import { createMiddleware } from "hono/factory";
import type { AppVariables } from "../types";

/**
 * CSP for `/test/pay` so Stripe.js / Payment Element can load scripts, frames, and XHR/fetch.
 * @see https://stripe.com/docs/security/guide#content-security-policy (Stripe.js section)
 *
 * Note: Messages like `utils.js` / `autoconsent.js` blocking on `script-src 'self'` usually come from
 * browser extensions injecting into the page; they are not from this app.
 */
const STRIPE_TEST_PAGE_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  // Built bundle + Stripe loader (subdomains used for performance)
  "script-src 'self' https://js.stripe.com https://*.js.stripe.com",
  // App CSS + Stripe-injected UI (Elements uses inline styles in controlled cases)
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.stripe.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // API + Stripe telemetry / network (fraud, Link, etc.)
  "connect-src 'self' https://api.stripe.com https://*.stripe.com https://m.stripe.network https://m.stripe.com https://r.stripe.com https://q.stripe.com",
  // Payment Element, 3DS, Link, hooks
  "frame-src 'self' https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://m.stripe.network",
  "worker-src 'self' blob:",
  "form-action 'self' https://hooks.stripe.com",
].join("; ");

/** Sets CSP only for `/test/pay` and assets under it (not for `/test` or the rest of the API). */
export const stripeTestPageCsp = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const p = c.req.path;
  if (p === "/test/pay" || p.startsWith("/test/pay/")) {
    c.header("Content-Security-Policy", STRIPE_TEST_PAGE_CSP);
  }
  await next();
});
