import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const paymentSessions = pgTable(
  "payment_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id").notNull(),
    checkoutSessionId: text("checkout_session_id").notNull(),
    orderReference: text("order_reference").notNull(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    customerReference: text("customer_reference"),
    status: text("status").notNull().default("pending"),
    gateway: text("gateway").notNull().default("stripe"),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripeCustomerId: text("stripe_customer_id"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    returnUrl: text("return_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("payment_sessions_tenant_checkout_uid").on(
      t.tenantId,
      t.checkoutSessionId,
    ),
    index("payment_sessions_tenant_idx").on(t.tenantId),
    index("payment_sessions_stripe_pi_idx").on(t.stripePaymentIntentId),
  ],
);

export const paymentRefunds = pgTable(
  "payment_refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id").notNull(),
    paymentSessionId: uuid("payment_session_id")
      .notNull()
      .references(() => paymentSessions.id, { onDelete: "cascade" }),
    stripeRefundId: text("stripe_refund_id").notNull().unique(),
    amount: integer("amount"),
    status: text("status").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("payment_refunds_session_idx").on(t.paymentSessionId)],
);

export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stripeEventId: text("stripe_event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    processed: boolean("processed").notNull().default(false),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("stripe_webhook_events_type_idx").on(t.eventType)],
);

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id").notNull(),
    scope: text("scope").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    statusCode: integer("status_code").notNull(),
    responseBody: text("response_body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("idempotency_records_uid").on(
      t.tenantId,
      t.scope,
      t.idempotencyKey,
    ),
  ],
);
