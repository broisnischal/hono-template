import { and, eq } from "drizzle-orm";
import type { DB } from "./db";
import { idempotencyRecords } from "./db/schema/payment";

export async function getCachedIdempotentResponse(
  db: DB,
  tenantId: string,
  scope: string,
  idempotencyKey: string,
): Promise<{ statusCode: number; responseBody: string } | null> {
  const [row] = await db
    .select()
    .from(idempotencyRecords)
    .where(
      and(
        eq(idempotencyRecords.tenantId, tenantId),
        eq(idempotencyRecords.scope, scope),
        eq(idempotencyRecords.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return row ? { statusCode: row.statusCode, responseBody: row.responseBody } : null;
}

export async function saveIdempotentResponse(
  db: DB,
  params: {
    tenantId: string;
    scope: string;
    idempotencyKey: string;
    statusCode: number;
    responseBody: string;
  },
): Promise<void> {
  await db
    .insert(idempotencyRecords)
    .values({
      tenantId: params.tenantId,
      scope: params.scope,
      idempotencyKey: params.idempotencyKey,
      statusCode: params.statusCode,
      responseBody: params.responseBody,
    })
    .onConflictDoUpdate({
      target: [
        idempotencyRecords.tenantId,
        idempotencyRecords.scope,
        idempotencyRecords.idempotencyKey,
      ],
      set: {
        statusCode: params.statusCode,
        responseBody: params.responseBody,
      },
    });
}
