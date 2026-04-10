import path from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { serveStatic } from "hono/bun";
import { env } from "./env";
import { setupOpenAPI } from "./handlers/openapi";
import {
  apiErrorHandler,
  apiNotFoundHandler,
  validationDefaultHook,
} from "./middlewares/error-handler";
import { internalAuth } from "./middlewares/internal-auth";
import { requestId } from "./middlewares/request-id";
import { stripeTestPageCsp } from "./middlewares/stripe-test-csp";
import { db } from "./lib/db";
import outgoingWebhookInternal from "./routes/outgoing-webhook-internal.routes";
import stripeInternal from "./routes/stripe-internal.routes";
import stripeWebhook from "./routes/stripe-webhook.routes";
import type { AppVariables } from "./types";
import { TestLanding } from "./pages/test-landing";

const app = new OpenAPIHono<{ Variables: AppVariables }>();

const testPayStaticRoot = path.join(process.cwd(), "static", "test-pay");

app.use("*", requestId);
app.use("*", stripeTestPageCsp);
app.use("*", async (c, next) => {
  c.set("db", db);
  await next();
});

app.get("/health", (c) => c.json({ ok: true }));

app.get("/test", (c) => c.html(<TestLanding />));

app.get("/api/public/stripe-publishable-key", (c) => {
  const publishableKey = env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return c.json(
      {
        error: {
          code: "config_missing",
          message:
            "STRIPE_PUBLISHABLE_KEY is not set. Add it to .env (Dashboard → Developers → API keys → Publishable key).",
          requestId: c.get("requestId"),
        },
      },
      503,
    );
  }
  return c.json({ publishableKey });
});

app.get("/test/pay", (c) => c.redirect("/test/pay/"));
app.use(
  "/test/pay/*",
  serveStatic({
    root: testPayStaticRoot,
    rewriteRequestPath: (pathname) => {
      const prefix = "/test/pay";
      if (!pathname.startsWith(prefix)) {
        return pathname;
      }
      const rest = pathname.slice(prefix.length);
      return rest === "" || rest === "/" ? "/" : rest.startsWith("/") ? rest : `/${rest}`;
    },
  }),
);

const internal = new OpenAPIHono<{ Variables: AppVariables }>({
  defaultHook: validationDefaultHook,
});
internal.use("*", internalAuth);
internal.route("/", stripeInternal);

const outgoing = new OpenAPIHono<{ Variables: AppVariables }>({
  defaultHook: validationDefaultHook,
});
outgoing.use("*", internalAuth);
outgoing.route("/", outgoingWebhookInternal);

app.route("/internal/stripe", internal);
app.route("/internal/webhooks", outgoing);
app.route("/webhooks/stripe", stripeWebhook);

app.onError(apiErrorHandler);
app.notFound(apiNotFoundHandler);

setupOpenAPI(app);

export default app;
