import { Hono } from "hono";
import type Stripe from "stripe";
import { env } from "../env";
import { db } from "../lib/db";
import { getStripe } from "../services/stripe/client";
import { processStripeWebhook } from "../services/stripe/webhook-processor";
import type { AppVariables } from "../types";
import { emitOutgoingForStripeEvent } from "../webhooks/emit";

const webhook = new Hono<{ Variables: AppVariables }>();

webhook.post("/", async (c) => {
  const requestId = c.get("requestId");
  const sig = c.req.header("stripe-signature");
  if (!sig) {
    return c.json(
      {
        error: {
          code: "missing_signature",
          message: "Missing Stripe-Signature header",
          requestId,
        },
      },
      400,
    );
  }
  const raw = await c.req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return c.json(
      {
        error: {
          code: "invalid_signature",
          message: "Invalid Stripe webhook signature",
          requestId,
        },
      },
      400,
    );
  }

  const result = await processStripeWebhook(db, event);
  if (!result.duplicate) {
    void emitOutgoingForStripeEvent(db, event).catch((err) => {
      console.error("[outgoing-webhook] emit failed", err);
    });
  }
  return c.json({ received: true, duplicate: result.duplicate });
});

export default webhook;
