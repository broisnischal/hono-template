import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { DB } from "../lib/db";
import { paymentSessions } from "../lib/db/schema/payment";
import type { OutgoingWebhookEnvelope, OutgoingPaymentPayload } from "./types";
import { deliverOutgoingJson, listActiveEndpointsForTenant } from "./deliver";

function mapStripeToOutgoingType(stripeType: string): string | null {
  const m: Record<string, string> = {
    "payment_intent.succeeded": "payment.succeeded",
    "payment_intent.payment_failed": "payment.failed",
    "payment_intent.canceled": "payment.canceled",
    "payment_intent.processing": "payment.processing",
    "checkout.session.completed": "payment.checkout_completed",
    "checkout.session.async_payment_failed": "payment.checkout_failed",
    "checkout.session.expired": "payment.checkout_expired",
  };
  return m[stripeType] ?? null;
}

async function findSessionForEvent(
  db: DB,
  event: Stripe.Event,
): Promise<(typeof paymentSessions.$inferSelect) | null> {
  switch (event.type) {
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
    case "payment_intent.processing": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const [row] = await db
        .select()
        .from(paymentSessions)
        .where(eq(paymentSessions.stripePaymentIntentId, pi.id))
        .limit(1);
      return row ?? null;
    }
    case "checkout.session.completed":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const cs = event.data.object as Stripe.Checkout.Session;
      const [byCheckout] = await db
        .select()
        .from(paymentSessions)
        .where(eq(paymentSessions.stripeCheckoutSessionId, cs.id))
        .limit(1);
      if (byCheckout) {
        return byCheckout;
      }
      const piId =
        typeof cs.payment_intent === "string"
          ? cs.payment_intent
          : cs.payment_intent?.id;
      if (!piId) {
        return null;
      }
      const [byPi] = await db
        .select()
        .from(paymentSessions)
        .where(eq(paymentSessions.stripePaymentIntentId, piId))
        .limit(1);
      return byPi ?? null;
    }
    default:
      return null;
  }
}

function toPayload(row: typeof paymentSessions.$inferSelect): OutgoingPaymentPayload {
  return {
    paymentSessionId: row.id,
    tenantId: row.tenantId,
    checkoutSessionId: row.checkoutSessionId,
    orderReference: row.orderReference,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    gateway: row.gateway,
    stripePaymentIntentId: row.stripePaymentIntentId,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId,
    stripeCustomerId: row.stripeCustomerId,
    metadata: row.metadata as Record<string, unknown>,
  };
}

/**
 * After a Stripe webhook is processed (non-duplicate), notify all active outgoing URLs for that tenant.
 * Runs best-effort; failures are recorded in `outgoing_webhook_deliveries`.
 */
export async function emitOutgoingForStripeEvent(db: DB, event: Stripe.Event): Promise<void> {
  const outgoingType = mapStripeToOutgoingType(event.type);
  if (!outgoingType) {
    return;
  }

  const session = await findSessionForEvent(db, event);
  if (!session) {
    return;
  }

  const tenantId = session.tenantId;

  const envelope: OutgoingWebhookEnvelope = {
    id: event.id,
    type: outgoingType,
    created: event.created,
    tenantId,
    data: {
      object: toPayload(session),
    },
    gateway: "stripe",
    stripe: {
      eventId: event.id,
      type: event.type,
    },
  };

  const body = JSON.stringify(envelope);
  const endpoints = await listActiveEndpointsForTenant(db, tenantId);

  await Promise.all(
    endpoints.map((ep) =>
      deliverOutgoingJson(db, ep, body, {
        tenantId,
        sourceEventId: event.id,
        eventType: outgoingType,
        payload: envelope as unknown as Record<string, unknown>,
      }),
    ),
  );
}
