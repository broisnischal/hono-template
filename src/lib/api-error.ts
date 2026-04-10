import type { Context } from "hono";
import type { AppVariables } from "../types";

/** Stable JSON shape for all API error responses. */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
    stripe?: {
      type?: string;
      code?: string;
      decline_code?: string;
      doc_url?: string;
    };
  };
};

/** Handlers use this so manual error responses match {@link apiErrorHandler}. */
export function jsonApiError(
  c: Context<{ Variables: AppVariables }>,
  status: number,
  code: string,
  message: string,
): Response {
  return c.json(
    {
      error: {
        code,
        message,
        requestId: c.get("requestId"),
      },
    },
    status,
  );
}
