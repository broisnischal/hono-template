import type Stripe from "stripe";
import { getStripe } from "./client";

export async function createSetupIntent(params: {
  stripeCustomerId: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.SetupIntent> {
  const stripe = getStripe();
  return stripe.setupIntents.create({
    customer: params.stripeCustomerId,
    payment_method_types: ["card"],
    metadata: params.metadata,
  });
}

export async function attachPaymentMethod(params: {
  paymentMethodId: string;
  stripeCustomerId: string;
}): Promise<Stripe.PaymentMethod> {
  const stripe = getStripe();
  return stripe.paymentMethods.attach(params.paymentMethodId, {
    customer: params.stripeCustomerId,
  });
}

export async function createSubscription(params: {
  stripeCustomerId: string;
  priceId: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.create({
    customer: params.stripeCustomerId,
    items: [{ price: params.priceId }],
    metadata: params.metadata,
  });
}

export async function cancelSubscription(
  subscriptionId: string,
  params?: { invoiceNow?: boolean; prorate?: boolean },
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.cancel(subscriptionId, {
    invoice_now: params?.invoiceNow,
    prorate: params?.prorate,
  });
}
