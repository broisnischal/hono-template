import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { DB } from "../../lib/db";
import { paymentSessions } from "../../lib/db/schema/payment";
import { getStripe } from "./client";

export type CreatePaymentIntentInput = {
  tenantId: string;
  checkoutSessionId: string;
  orderReference: string;
  amount: number;
  currency: string;
  customerReference?: string;
  returnUrl?: string;
  metadata?: Record<string, string>;
  stripeCustomerId?: string;
};

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

export async function createStripePaymentIntent(
  db: DB,
  input: CreatePaymentIntentInput,
): Promise<{ session: typeof paymentSessions.$inferSelect; paymentIntent: Stripe.PaymentIntent }> {
  const stripe = getStripe();
  const meta: Record<string, string> = {
    tenant_id: input.tenantId,
    checkout_session_id: input.checkoutSessionId,
    order_reference: input.orderReference,
    ...(input.metadata ?? {}),
  };

  const [existing] = await db
    .select()
    .from(paymentSessions)
    .where(
      and(
        eq(paymentSessions.tenantId, input.tenantId),
        eq(paymentSessions.checkoutSessionId, input.checkoutSessionId),
      ),
    )
    .limit(1);

  if (existing?.stripePaymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(existing.stripePaymentIntentId);
    return { session: existing, paymentIntent: pi };
  }

  const pi = await stripe.paymentIntents.create({
    amount: input.amount,
    currency: input.currency.toLowerCase(),
    customer: input.stripeCustomerId,
    metadata: meta,
    automatic_payment_methods: { enabled: true },
  });

  const [row] = await db
    .insert(paymentSessions)
    .values({
      tenantId: input.tenantId,
      checkoutSessionId: input.checkoutSessionId,
      orderReference: input.orderReference,
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      customerReference: input.customerReference,
      status: mapPiStatus(pi.status),
      stripePaymentIntentId: pi.id,
      stripeCustomerId:
        typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? input.stripeCustomerId,
      metadata: { ...meta },
      returnUrl: input.returnUrl,
    })
    .onConflictDoUpdate({
      target: [paymentSessions.tenantId, paymentSessions.checkoutSessionId],
      set: {
        orderReference: input.orderReference,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        status: mapPiStatus(pi.status),
        stripePaymentIntentId: pi.id,
        stripeCustomerId:
          typeof pi.customer === "string"
            ? pi.customer
            : pi.customer?.id ?? input.stripeCustomerId,
        metadata: { ...meta },
        returnUrl: input.returnUrl,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) {
    throw new Error("failed to persist payment session");
  }
  return { session: row, paymentIntent: pi };
}

export async function getPaymentIntentForSession(
  db: DB,
  tenantId: string,
  id: string,
): Promise<{
  session: typeof paymentSessions.$inferSelect;
  paymentIntent: Stripe.PaymentIntent;
} | null> {
  const stripe = getStripe();
  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(and(eq(paymentSessions.tenantId, tenantId), eq(paymentSessions.id, id)))
    .limit(1);
  if (!session?.stripePaymentIntentId) {
    return null;
  }
  const paymentIntent = await stripe.paymentIntents.retrieve(session.stripePaymentIntentId);
  return { session, paymentIntent };
}

export async function cancelPaymentIntentForSession(
  db: DB,
  tenantId: string,
  id: string,
): Promise<Stripe.PaymentIntent | null> {
  const stripe = getStripe();
  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(and(eq(paymentSessions.tenantId, tenantId), eq(paymentSessions.id, id)))
    .limit(1);
  if (!session?.stripePaymentIntentId) {
    return null;
  }
  const pi = await stripe.paymentIntents.cancel(session.stripePaymentIntentId);
  await db
    .update(paymentSessions)
    .set({
      status: mapPiStatus(pi.status),
      updatedAt: new Date(),
    })
    .where(eq(paymentSessions.id, session.id));
  return pi;
}
