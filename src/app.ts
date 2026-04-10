import { OpenAPIHono } from "@hono/zod-openapi";
import { setupOpenAPI } from "./handlers/openapi";
import {
  apiErrorHandler,
  apiNotFoundHandler,
  validationDefaultHook,
} from "./middlewares/error-handler";
import { internalAuth } from "./middlewares/internal-auth";
import { requestId } from "./middlewares/request-id";
import { db } from "./lib/db";
import outgoingWebhookInternal from "./routes/outgoing-webhook-internal.routes";
import stripeInternal from "./routes/stripe-internal.routes";
import stripeWebhook from "./routes/stripe-webhook.routes";
import type { AppVariables } from "./types";

const app = new OpenAPIHono<{ Variables: AppVariables }>();

app.use("*", requestId);
app.use("*", async (c, next) => {
  c.set("db", db);
  await next();
});

app.get("/health", (c) => c.json({ ok: true }));

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
