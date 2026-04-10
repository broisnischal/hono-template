import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { DB } from "../../lib/db";
import { paymentSessions, stripeWebhookEvents } from "../../lib/db/schema/payment";

function mapPiStatus(status: Stripe.PaymentIntent.Status): string {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "canceled":
      return "canceled";
    case "processing":
      return "processing";
    case "requires_capture":
      return "requires_capture";
    default:
      return "pending";
  }
}

async function syncPaymentIntent(db: DB, pi: Stripe.PaymentIntent): Promise<void> {
  await db
    .update(paymentSessions)
    .set({
      status: mapPiStatus(pi.status),
      stripePaymentIntentId: pi.id,
      updatedAt: new Date(),
    })
    .where(eq(paymentSessions.stripePaymentIntentId, pi.id));
}

async function syncCheckoutSession(db: DB, session: Stripe.Checkout.Session): Promise<void> {
  const piId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (piId) {
    await db
      .update(paymentSessions)
      .set({
        stripePaymentIntentId: piId,
        status: session.payment_status === "paid" ? "succeeded" : "pending",
        stripeCheckoutSessionId: session.id,
        updatedAt: new Date(),
      })
      .where(eq(paymentSessions.stripeCheckoutSessionId, session.id));
  }
}

/**
 * Persists the event and applies idempotent side effects to `payment_sessions`.
 */
export async function processStripeWebhook(
  db: DB,
  event: Stripe.Event,
): Promise<{ duplicate: boolean }> {
  const inserted = await db
    .insert(stripeWebhookEvents)
    .values({
      stripeEventId: event.id,
      eventType: event.type,
      processed: false,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: stripeWebhookEvents.id });

  if (inserted.length === 0) {
    return { duplicate: true };
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
      case "payment_intent.processing": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await syncPaymentIntent(db, pi);
        break;
      }
      case "checkout.session.completed":
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await syncCheckoutSession(db, session);
        break;
      }
      default:
        break;
    }

    await db
      .update(stripeWebhookEvents)
      .set({ processed: true })
      .where(eq(stripeWebhookEvents.stripeEventId, event.id));
  } catch (e) {
    throw e;
  }

  return { duplicate: false };
}
