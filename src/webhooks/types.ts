/**
 * Outgoing webhook envelope delivered to tenant apps (your main application).
 * Verify with {@link verifyOutgoingWebhookSignature} using the endpoint secret.
 */
export type OutgoingWebhookEnvelope = {
  /** Idempotency key: equals Stripe event id when source is Stripe. */
  id: string;
  /** Normalized type, e.g. `payment.succeeded`. */
  type: string;
  created: number;
  tenantId: string;
  data: {
    object: OutgoingPaymentPayload;
  };
  gateway: "stripe";
  stripe: {
    eventId: string;
    type: string;
  };
};

export type OutgoingPaymentPayload = {
  paymentSessionId: string;
  tenantId: string;
  checkoutSessionId: string;
  orderReference: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeCustomerId: string | null;
  metadata: Record<string, unknown>;
};
