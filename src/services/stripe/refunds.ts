import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { DB } from "../../lib/db";
import { paymentRefunds, paymentSessions } from "../../lib/db/schema/payment";
import { getStripe } from "./client";

export async function createRefund(
  db: DB,
  params: {
    tenantId: string;
    paymentSessionId: string;
    amount?: number;
    reason?: Stripe.RefundCreateParams.Reason;
  },
): Promise<{ refund: Stripe.Refund; row: typeof paymentRefunds.$inferSelect }> {
  const stripe = getStripe();
  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(
      and(
        eq(paymentSessions.tenantId, params.tenantId),
        eq(paymentSessions.id, params.paymentSessionId),
      ),
    )
    .limit(1);

  if (!session?.stripePaymentIntentId) {
    throw new Error("payment session has no Stripe payment intent");
  }

  const refund = await stripe.refunds.create({
    payment_intent: session.stripePaymentIntentId,
    amount: params.amount,
    reason: params.reason,
  });

  const [row] = await db
    .insert(paymentRefunds)
    .values({
      tenantId: params.tenantId,
      paymentSessionId: session.id,
      stripeRefundId: refund.id,
      amount: refund.amount ?? null,
      status: refund.status ?? "unknown",
      metadata: {
        reason: refund.reason ?? "",
      },
    })
    .returning();

  if (!row) {
    throw new Error("failed to persist refund");
  }

  return { refund, row };
}

export async function getRefund(stripeRefundId: string): Promise<Stripe.Refund> {
  const stripe = getStripe();
  return stripe.refunds.retrieve(stripeRefundId);
}
