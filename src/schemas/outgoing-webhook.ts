import { z } from "zod";

export const registerOutgoingWebhookBody = z.object({
  tenantId: z.string().min(1),
  url: z.url(),
  description: z.string().optional(),
  /** If omitted, a random secret is generated (returned once in the response). */
  secret: z.string().min(16).optional(),
});

export const listOutgoingWebhooksQuery = z.object({
  tenantId: z.string().min(1),
});

export const endpointIdParam = z.object({
  id: z.string().uuid(),
});

export const patchOutgoingWebhookBody = z.object({
  tenantId: z.string().min(1),
  url: z.url().optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});
