import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { jsonApiError } from "../lib/api-error";
import { getCachedIdempotentResponse, saveIdempotentResponse } from "../lib/idempotency";
import { db } from "../lib/db";
import {
  attachPaymentMethodBody,
  createCheckoutBody,
  createCustomerBody,
  createPaymentIntentBody,
  createRefundBody,
  createSetupIntentBody,
  createSubscriptionBody,
  paymentSessionIdParam,
} from "../schemas/stripe";
import { createStripeCheckoutSession, getCheckoutSession } from "../services/stripe/checkout";
import { createCustomer, getCustomer } from "../services/stripe/customers";
import {
  cancelPaymentIntentForSession,
  createStripePaymentIntent,
  getPaymentIntentForSession,
} from "../services/stripe/payment-sessions";
import { createRefund, getRefund as getStripeRefund } from "../services/stripe/refunds";
import {
  attachPaymentMethod,
  cancelSubscription,
  createSetupIntent,
  createSubscription,
} from "../services/stripe/setup-subscriptions";
import type { AppVariables } from "../types";

const routes = new OpenAPIHono<{ Variables: AppVariables }>();

const jsonOk = <T extends z.ZodType>(schema: T) => ({
  description: "OK",
  content: { "application/json": { schema } },
});

const postPaymentIntent = createRoute({
  method: "post",
  path: "/payment-intents",
  summary: "Create or resume Stripe PaymentIntent",
  request: {
    body: {
      content: { "application/json": { schema: createPaymentIntentBody } },
    },
  },
  responses: {
    200: jsonOk(
      z.object({
        paymentSessionId: z.string().uuid(),
        stripePaymentIntentId: z.string(),
        clientSecret: z.string().nullable(),
        status: z.string(),
      }),
    ),
    401: { description: "Unauthorized" },
  },
});

routes.openapi(postPaymentIntent, async (c) => {
  const body = c.req.valid("json");
  const idem = c.req.header("idempotency-key");
  const scope = "stripe:payment_intents:create";
  if (idem) {
    const cached = await getCachedIdempotentResponse(db, body.tenantId, scope, idem);
    if (cached) {
      return c.json(
        JSON.parse(cached.responseBody) as {
          paymentSessionId: string;
          stripePaymentIntentId: string;
          clientSecret: string | null;
          status: string;
        },
        200,
      );
    }
  }

  const { session, paymentIntent } = await createStripePaymentIntent(db, {
    tenantId: body.tenantId,
    checkoutSessionId: body.checkoutSessionId,
    orderReference: body.orderReference,
    amount: body.amount,
    currency: body.currency,
    customerReference: body.customerReference,
    returnUrl: body.returnUrl,
    metadata: body.metadata,
    stripeCustomerId: body.stripeCustomerId,
  });

  const payload = {
    paymentSessionId: session.id,
    stripePaymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    status: paymentIntent.status,
  };
  const res = c.json(payload, 200);
  if (idem) {
    await saveIdempotentResponse(db, {
      tenantId: body.tenantId,
      scope,
      idempotencyKey: idem,
      statusCode: 200,
      responseBody: JSON.stringify(payload),
    });
  }
  return res;
});

const getPaymentIntent = createRoute({
  method: "get",
  path: "/payment-intents/{id}",
  summary: "Get PaymentIntent by internal payment session id",
  request: { params: paymentSessionIdParam },
  responses: {
    200: jsonOk(
      z.object({
        paymentSessionId: z.string().uuid(),
        stripePaymentIntent: z.record(z.string(), z.unknown()),
      }),
    ),
    404: { description: "Not found" },
  },
});

routes.openapi(getPaymentIntent, async (c) => {
  const { id } = c.req.valid("param");
  const tenantId = c.req.query("tenantId");
  if (!tenantId) {
    return jsonApiError(c, 400, "validation_error", "tenantId query parameter is required");
  }
  const found = await getPaymentIntentForSession(db, tenantId, id);
  if (!found) {
    return jsonApiError(c, 404, "not_found", "Payment session not found");
  }
  return c.json(
    {
      paymentSessionId: found.session.id,
      stripePaymentIntent: found.paymentIntent as unknown as Record<string, unknown>,
    },
    200,
  );
});

const cancelPaymentIntent = createRoute({
  method: "post",
  path: "/payment-intents/{id}/cancel",
  request: { params: paymentSessionIdParam },
  responses: {
    200: jsonOk(z.object({ canceled: z.boolean(), status: z.string().optional() })),
    404: { description: "Not found" },
  },
});

routes.openapi(cancelPaymentIntent, async (c) => {
  const { id } = c.req.valid("param");
  const tenantId = c.req.query("tenantId");
  if (!tenantId) {
    return jsonApiError(c, 400, "validation_error", "tenantId query parameter is required");
  }
  const pi = await cancelPaymentIntentForSession(db, tenantId, id);
  if (!pi) {
    return jsonApiError(c, 404, "not_found", "Payment session not found");
  }
  return c.json({ canceled: pi.status === "canceled", status: pi.status }, 200);
});

const postCheckout = createRoute({
  method: "post",
  path: "/checkout-sessions",
  request: {
    body: { content: { "application/json": { schema: createCheckoutBody } } },
  },
  responses: {
    200: jsonOk(
      z.object({
        paymentSessionId: z.string().uuid(),
        stripeCheckoutSessionId: z.string(),
        url: z.string().nullable(),
        status: z.string().nullable(),
      }),
    ),
  },
});

routes.openapi(postCheckout, async (c) => {
  const body = c.req.valid("json");
  const idem = c.req.header("idempotency-key");
  const scope = "stripe:checkout_sessions:create";
  if (idem) {
    const cached = await getCachedIdempotentResponse(db, body.tenantId, scope, idem);
    if (cached) {
      return c.json(
        JSON.parse(cached.responseBody) as {
          paymentSessionId: string;
          stripeCheckoutSessionId: string;
          url: string | null;
          status: string | null;
        },
        200,
      );
    }
  }

  const { session, checkout } = await createStripeCheckoutSession(db, {
    tenantId: body.tenantId,
    checkoutSessionId: body.checkoutSessionId,
    orderReference: body.orderReference,
    amount: body.amount,
    currency: body.currency,
    successUrl: body.successUrl,
    cancelUrl: body.cancelUrl,
    customerReference: body.customerReference,
    stripeCustomerId: body.stripeCustomerId,
    metadata: body.metadata,
  });

  const payload = {
    paymentSessionId: session.id,
    stripeCheckoutSessionId: checkout.id,
    url: checkout.url,
    status: checkout.status,
  };
  const res = c.json(payload, 200);
  if (idem) {
    await saveIdempotentResponse(db, {
      tenantId: body.tenantId,
      scope,
      idempotencyKey: idem,
      statusCode: 200,
      responseBody: JSON.stringify(payload),
    });
  }
  return res;
});

const getCheckout = createRoute({
  method: "get",
  path: "/checkout-sessions/{id}",
  request: { params: paymentSessionIdParam },
  responses: {
    200: jsonOk(
      z.object({
        paymentSessionId: z.string().uuid(),
        checkout: z.record(z.string(), z.unknown()),
      }),
    ),
    404: { description: "Not found" },
  },
});

routes.openapi(getCheckout, async (c) => {
  const { id } = c.req.valid("param");
  const tenantId = c.req.query("tenantId");
  if (!tenantId) {
    return jsonApiError(c, 400, "validation_error", "tenantId query parameter is required");
  }
  const found = await getCheckoutSession(db, tenantId, id);
  if (!found) {
    return jsonApiError(c, 404, "not_found", "Payment session not found");
  }
  return c.json(
    {
      paymentSessionId: found.session.id,
      checkout: found.checkout as unknown as Record<string, unknown>,
    },
    200,
  );
});

const postRefund = createRoute({
  method: "post",
  path: "/refunds",
  request: {
    body: { content: { "application/json": { schema: createRefundBody } } },
  },
  responses: {
    200: jsonOk(
      z.object({
        refundId: z.string(),
        status: z.string().nullable(),
        amount: z.number().nullable(),
      }),
    ),
    400: { description: "Bad request" },
  },
});

routes.openapi(postRefund, async (c) => {
  const body = c.req.valid("json");
  try {
    const { refund } = await createRefund(db, {
      tenantId: body.tenantId,
      paymentSessionId: body.paymentSessionId,
      amount: body.amount,
      reason: body.reason,
    });
    return c.json(
      { refundId: refund.id, status: refund.status, amount: refund.amount ?? null },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return jsonApiError(c, 400, "refund_error", msg);
  }
});

const getRefundRoute = createRoute({
  method: "get",
  path: "/refunds/{refundId}",
  request: {
    params: z.object({ refundId: z.string().min(1) }),
  },
  responses: {
    200: jsonOk(z.record(z.string(), z.unknown())),
    404: { description: "Not found" },
  },
});

routes.openapi(getRefundRoute, async (c) => {
  const { refundId } = c.req.valid("param");
  try {
    const refund = await getStripeRefund(refundId);
    return c.json(refund as unknown as Record<string, unknown>, 200);
  } catch {
    return jsonApiError(c, 404, "not_found", "Refund not found");
  }
});

const postCustomer = createRoute({
  method: "post",
  path: "/customers",
  request: {
    body: { content: { "application/json": { schema: createCustomerBody } } },
  },
  responses: {
    200: jsonOk(
      z.object({
        stripeCustomerId: z.string(),
        email: z.string().nullable().optional(),
      }),
    ),
  },
});

routes.openapi(postCustomer, async (c) => {
  const body = c.req.valid("json");
  const customer = await createCustomer({
    tenantId: body.tenantId,
    email: body.email,
    name: body.name,
    metadata: body.metadata,
  });
  return c.json({ stripeCustomerId: customer.id, email: customer.email }, 200);
});

const getCustomerRoute = createRoute({
  method: "get",
  path: "/customers/{stripeCustomerId}",
  request: {
    params: z.object({ stripeCustomerId: z.string().min(1) }),
  },
  responses: {
    200: jsonOk(z.record(z.string(), z.unknown())),
    404: { description: "Not found" },
  },
});

routes.openapi(getCustomerRoute, async (c) => {
  const { stripeCustomerId } = c.req.valid("param");
  const customer = await getCustomer(stripeCustomerId);
  if (customer.deleted) {
    return jsonApiError(c, 404, "not_found", "Customer was deleted");
  }
  return c.json(customer as unknown as Record<string, unknown>, 200);
});

const postSetupIntent = createRoute({
  method: "post",
  path: "/setup-intents",
  request: {
    body: { content: { "application/json": { schema: createSetupIntentBody } } },
  },
  responses: {
    200: jsonOk(
      z.object({
        setupIntentId: z.string(),
        clientSecret: z.string().nullable(),
        status: z.string().nullable(),
      }),
    ),
  },
});

routes.openapi(postSetupIntent, async (c) => {
  const body = c.req.valid("json");
  const si = await createSetupIntent({
    stripeCustomerId: body.stripeCustomerId,
    metadata: body.metadata,
  });
  return c.json(
    { setupIntentId: si.id, clientSecret: si.client_secret, status: si.status },
    200,
  );
});

const postAttachPm = createRoute({
  method: "post",
  path: "/payment-methods/attach",
  request: {
    body: { content: { "application/json": { schema: attachPaymentMethodBody } } },
  },
  responses: {
    200: jsonOk(z.record(z.string(), z.unknown())),
  },
});

routes.openapi(postAttachPm, async (c) => {
  const body = c.req.valid("json");
  const pm = await attachPaymentMethod({
    paymentMethodId: body.paymentMethodId,
    stripeCustomerId: body.stripeCustomerId,
  });
  return c.json(pm as unknown as Record<string, unknown>, 200);
});

const postSubscription = createRoute({
  method: "post",
  path: "/subscriptions",
  request: {
    body: { content: { "application/json": { schema: createSubscriptionBody } } },
  },
  responses: {
    200: jsonOk(
      z.object({
        subscriptionId: z.string(),
        status: z.string().nullable(),
      }),
    ),
  },
});

routes.openapi(postSubscription, async (c) => {
  const body = c.req.valid("json");
  const sub = await createSubscription({
    stripeCustomerId: body.stripeCustomerId,
    priceId: body.priceId,
    metadata: body.metadata,
  });
  return c.json({ subscriptionId: sub.id, status: sub.status }, 200);
});

const postCancelSub = createRoute({
  method: "post",
  path: "/subscriptions/{subscriptionId}/cancel",
  request: {
    params: z.object({ subscriptionId: z.string().min(1) }),
  },
  responses: {
    200: jsonOk(z.object({ subscriptionId: z.string(), status: z.string().nullable() })),
  },
});

routes.openapi(postCancelSub, async (c) => {
  const { subscriptionId } = c.req.valid("param");
  const sub = await cancelSubscription(subscriptionId);
  return c.json({ subscriptionId: sub.id, status: sub.status }, 200);
});

export default routes;
