import { and, eq } from "drizzle-orm";
import type { DB } from "../lib/db";
import {
  outgoingWebhookDeliveries,
  outgoingWebhookEndpoints,
} from "../lib/db/schema/outgoing-webhook";
import { signOutgoingWebhook } from "./signing";

const USER_AGENT = "payment-service/1";

export async function deliverOutgoingJson(
  db: DB,
  endpoint: typeof outgoingWebhookEndpoints.$inferSelect,
  body: string,
  meta: {
    tenantId: string;
    sourceEventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const { timestamp, signatureHeader } = signOutgoingWebhook(endpoint.secret, body);
  const started = Date.now();
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "user-agent": USER_AGENT,
        "x-payment-webhook-signature": signatureHeader,
        "x-payment-webhook-timestamp": timestamp,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const durationMs = Date.now() - started;
    await db.insert(outgoingWebhookDeliveries).values({
      endpointId: endpoint.id,
      tenantId: meta.tenantId,
      sourceEventId: meta.sourceEventId,
      eventType: meta.eventType,
      payload: meta.payload,
      httpStatus: res.status,
      durationMs,
    });
  } catch (e) {
    const durationMs = Date.now() - started;
    const message = e instanceof Error ? e.message : String(e);
    await db.insert(outgoingWebhookDeliveries).values({
      endpointId: endpoint.id,
      tenantId: meta.tenantId,
      sourceEventId: meta.sourceEventId,
      eventType: meta.eventType,
      payload: meta.payload,
      httpStatus: null,
      error: message,
      durationMs,
    });
  }
}

export async function listActiveEndpointsForTenant(
  db: DB,
  tenantId: string,
): Promise<(typeof outgoingWebhookEndpoints.$inferSelect)[]> {
  return db
    .select()
    .from(outgoingWebhookEndpoints)
    .where(
      and(
        eq(outgoingWebhookEndpoints.tenantId, tenantId),
        eq(outgoingWebhookEndpoints.isActive, true),
      ),
    );
}
