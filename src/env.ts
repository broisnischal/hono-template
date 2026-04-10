import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.url(),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  /** Bearer token for internal routes (rotate; prefer short-lived tokens in production). */
  INTERNAL_API_TOKEN: z.string().min(16),
  /** Public publishable key (pk_test_… / pk_live_…) for the browser test UI at /test/pay. */
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  PORT: z.coerce.number().optional().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
