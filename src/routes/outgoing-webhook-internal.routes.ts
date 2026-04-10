import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { jsonApiError } from "../lib/api-error";
import { db } from "../lib/db";
import { outgoingWebhookEndpoints } from "../lib/db/schema/outgoing-webhook";
import {
  endpointIdParam,
  listOutgoingWebhooksQuery,
  patchOutgoingWebhookBody,
  registerOutgoingWebhookBody,
} from "../schemas/outgoing-webhook";
import type { AppVariables } from "../types";

const routes = new OpenAPIHono<{ Variables: AppVariables }>();

const jsonOk = <T extends z.ZodType>(schema: T) => ({
  description: "OK",
  content: { "application/json": { schema } },
});

const postRegister = createRoute({
  method: "post",
  path: "/endpoints",
  summary: "Register an outgoing webhook URL for a tenant",
  request: {
    body: {
      content: { "application/json": { schema: registerOutgoingWebhookBody } },
    },
  },
  responses: {
    200: jsonOk(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string(),
        url: z.string(),
        description: z.string().nullable(),
        isActive: z.boolean(),
        /** Present only when the service generated the secret (omit if you supplied `secret`). */
        secret: z.string().optional(),
      }),
    ),
    409: { description: "URL already registered for tenant" },
  },
});

routes.openapi(postRegister, async (c) => {
  const body = c.req.valid("json");
  const secret = body.secret ?? randomBytes(32).toString("hex");
  try {
    const [row] = await db
      .insert(outgoingWebhookEndpoints)
      .values({
        tenantId: body.tenantId,
        url: body.url,
        description: body.description ?? null,
        secret,
        isActive: true,
      })
      .returning();
    if (!row) {
      return jsonApiError(c, 500, "insert_failed", "Could not create webhook endpoint");
    }
    return c.json(
      {
        id: row.id,
        tenantId: row.tenantId,
        url: row.url,
        description: row.description,
        isActive: row.isActive,
        ...(body.secret ? {} : { secret }),
      },
      200,
    );
  } catch {
    return jsonApiError(c, 409, "conflict", "URL already registered for this tenant");
  }
});

const getList = createRoute({
  method: "get",
  path: "/endpoints",
  summary: "List outgoing webhook endpoints for a tenant",
  request: { query: listOutgoingWebhooksQuery },
  responses: {
    200: jsonOk(
      z.array(
        z.object({
          id: z.uuid(),
          tenantId: z.string(),
          url: z.string(),
          description: z.string().nullable(),
          isActive: z.boolean(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      ),
    ),
  },
});

routes.openapi(getList, async (c) => {
  const { tenantId } = c.req.valid("query");
  const rows = await db
    .select({
      id: outgoingWebhookEndpoints.id,
      tenantId: outgoingWebhookEndpoints.tenantId,
      url: outgoingWebhookEndpoints.url,
      description: outgoingWebhookEndpoints.description,
      isActive: outgoingWebhookEndpoints.isActive,
      createdAt: outgoingWebhookEndpoints.createdAt,
      updatedAt: outgoingWebhookEndpoints.updatedAt,
    })
    .from(outgoingWebhookEndpoints)
    .where(eq(outgoingWebhookEndpoints.tenantId, tenantId));
  return c.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    200,
  );
});

const patchEndpoint = createRoute({
  method: "patch",
  path: "/endpoints/{id}",
  request: {
    params: endpointIdParam,
    body: {
      content: { "application/json": { schema: patchOutgoingWebhookBody } },
    },
  },
  responses: {
    200: jsonOk(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string(),
        url: z.string(),
        description: z.string().nullable(),
        isActive: z.boolean(),
      }),
    ),
    404: { description: "Not found" },
  },
});

routes.openapi(patchEndpoint, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const [existing] = await db
    .select()
    .from(outgoingWebhookEndpoints)
    .where(
      and(
        eq(outgoingWebhookEndpoints.id, id),
        eq(outgoingWebhookEndpoints.tenantId, body.tenantId),
      ),
    )
    .limit(1);
  if (!existing) {
    return jsonApiError(c, 404, "not_found", "Webhook endpoint not found");
  }
  const [row] = await db
    .update(outgoingWebhookEndpoints)
    .set({
      url: body.url ?? existing.url,
      description:
        body.description !== undefined
          ? body.description
          : existing.description,
      isActive: body.isActive ?? existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(outgoingWebhookEndpoints.id, id))
    .returning();
  if (!row) {
    return jsonApiError(c, 404, "not_found", "Webhook endpoint not found");
  }
  return c.json(
    {
      id: row.id,
      tenantId: row.tenantId,
      url: row.url,
      description: row.description,
      isActive: row.isActive,
    },
    200,
  );
});

const deleteEndpoint = createRoute({
  method: "delete",
  path: "/endpoints/{id}",
  request: {
    params: endpointIdParam,
    query: listOutgoingWebhooksQuery,
  },
  responses: {
    204: { description: "Deleted" },
    404: { description: "Not found" },
  },
});

routes.openapi(deleteEndpoint, async (c) => {
  const { id } = c.req.valid("param");
  const { tenantId } = c.req.valid("query");
  const deleted = await db
    .delete(outgoingWebhookEndpoints)
    .where(
      and(
        eq(outgoingWebhookEndpoints.id, id),
        eq(outgoingWebhookEndpoints.tenantId, tenantId),
      ),
    )
    .returning({ id: outgoingWebhookEndpoints.id });
  if (deleted.length === 0) {
    return jsonApiError(c, 404, "not_found", "Webhook endpoint not found");
  }
  return c.body(null, 204);
});

export default routes;
