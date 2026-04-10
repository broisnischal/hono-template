import type { DB } from "./lib/db";

/** Hono context variables (request-scoped). */
export type AppVariables = {
  db: DB;
  /** Set by {@link requestId} middleware when present. */
  requestId?: string;
};
