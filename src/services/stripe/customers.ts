import type Stripe from "stripe";
import { getStripe } from "./client";

export async function createCustomer(params: {
  tenantId: string;
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
  const stripe = getStripe();
  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      tenant_id: params.tenantId,
      ...(params.metadata ?? {}),
    },
  });
}

export async function getCustomer(stripeCustomerId: string): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
  const stripe = getStripe();
  return stripe.customers.retrieve(stripeCustomerId);
}
