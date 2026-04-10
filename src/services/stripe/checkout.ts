import type Stripe from "stripe";
import type { DB } from "../../lib/db";
import { paymentSessions } from "../../lib/db/schema/payment";
import { and, eq } from "drizzle-orm";
import { getStripe } from "./client";

export type CreateCheckoutSessionInput = {
  tenantId: string;
  checkoutSessionId: string;
  orderReference: string;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  customerReference?: string;
  stripeCustomerId?: string;
  metadata?: Record<string, string>;
};

export async function createStripeCheckoutSession(
  db: DB,
  input: CreateCheckoutSessionInput,
): Promise<{ session: typeof paymentSessions.$inferSelect; checkout: Stripe.Checkout.Session }> {
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

  if (existing?.stripeCheckoutSessionId) {
    const cs = await stripe.checkout.sessions.retrieve(existing.stripeCheckoutSessionId);
    return { session: existing, checkout: cs };
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer: input.stripeCustomerId,
    client_reference_id: input.orderReference,
    metadata: meta,
    line_items: [
      {
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: input.amount,
          product_data: { name: input.orderReference },
        },
        quantity: 1,
      },
    ],
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
      status: checkout.status === "open" ? "pending" : checkout.status ?? "pending",
      stripeCheckoutSessionId: checkout.id,
      stripeCustomerId:
        typeof checkout.customer === "string"
          ? checkout.customer
          : checkout.customer?.id ?? input.stripeCustomerId,
      metadata: { ...meta },
    })
    .onConflictDoUpdate({
      target: [paymentSessions.tenantId, paymentSessions.checkoutSessionId],
      set: {
        orderReference: input.orderReference,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        status: checkout.status === "open" ? "pending" : checkout.status ?? "pending",
        stripeCheckoutSessionId: checkout.id,
        stripeCustomerId:
          typeof checkout.customer === "string"
            ? checkout.customer
            : checkout.customer?.id ?? input.stripeCustomerId,
        metadata: { ...meta },
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) {
    throw new Error("failed to persist payment session");
  }
  return { session: row, checkout };
}

export async function getCheckoutSession(
  db: DB,
  tenantId: string,
  internalSessionId: string,
): Promise<{ session: typeof paymentSessions.$inferSelect; checkout: Stripe.Checkout.Session } | null> {
  const stripe = getStripe();
  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(and(eq(paymentSessions.tenantId, tenantId), eq(paymentSessions.id, internalSessionId)))
    .limit(1);
  if (!session?.stripeCheckoutSessionId) {
    return null;
  }
  const checkout = await stripe.checkout.sessions.retrieve(session.stripeCheckoutSessionId);
  return { session, checkout };
}
