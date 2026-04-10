import { z } from "zod";

export const tenantBody = z.object({
  tenantId: z.string().min(1).openapi({ example: "shop-a" }),
});

export const createPaymentIntentBody = tenantBody.extend({
  checkoutSessionId: z.string().min(1),
  orderReference: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string().length(3),
  customerReference: z.string().optional(),
  returnUrl: z.url().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  stripeCustomerId: z.string().optional(),
});

export const paymentSessionIdParam = z.object({
  id: z.string().uuid(),
});

export const createCheckoutBody = tenantBody.extend({
  checkoutSessionId: z.string().min(1),
  orderReference: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string().length(3),
  successUrl: z.url(),
  cancelUrl: z.url(),
  customerReference: z.string().optional(),
  stripeCustomerId: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const createRefundBody = tenantBody.extend({
  paymentSessionId: z.string().uuid(),
  amount: z.number().int().positive().optional(),
  reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
});

export const createCustomerBody = tenantBody.extend({
  email: z.string().email().optional(),
  name: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const createSetupIntentBody = tenantBody.extend({
  stripeCustomerId: z.string().min(1),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const createSubscriptionBody = tenantBody.extend({
  stripeCustomerId: z.string().min(1),
  priceId: z.string().min(1),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const attachPaymentMethodBody = tenantBody.extend({
  stripeCustomerId: z.string().min(1),
  paymentMethodId: z.string().min(1),
});
