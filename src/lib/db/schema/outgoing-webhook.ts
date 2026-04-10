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
} from "drizzle-orm/pg-core";

export const outgoingWebhookEndpoints = pgTable(
  "outgoing_webhook_endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id").notNull(),
    url: text("url").notNull(),
    /** Shared secret for HMAC; store like API keys (rotate via API). */
    secret: text("secret").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("outgoing_webhook_endpoints_tenant_idx").on(t.tenantId),
    uniqueIndex("outgoing_webhook_endpoints_tenant_url_uid").on(t.tenantId, t.url),
  ],
);

export const outgoingWebhookDeliveries = pgTable(
  "outgoing_webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => outgoingWebhookEndpoints.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    sourceEventId: text("source_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    httpStatus: integer("http_status"),
    error: text("error"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("outgoing_webhook_deliveries_endpoint_idx").on(t.endpointId),
    index("outgoing_webhook_deliveries_tenant_idx").on(t.tenantId),
    index("outgoing_webhook_deliveries_source_idx").on(t.sourceEventId),
  ],
);
