import type { Hook } from "@hono/zod-openapi";
import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { DatabaseError } from "pg";
import Stripe from "stripe";
import type { ZodError } from "zod";
import type { ApiErrorBody } from "../lib/api-error";
import type { AppVariables } from "../types";

const isProd = process.env.NODE_ENV === "production";

function requestIdFrom(
  c: Context<{ Variables: AppVariables }>,
): string | undefined {
  return c.get("requestId");
}

function formatZodIssues(error: ZodError): {
  issues: { path: (string | number)[]; message: string }[];
} {
  return {
    issues: error.issues.map((i) => ({
      path: i.path,
      message: i.message,
    })),
  };
}

function stripeHttpStatus(err: Stripe.errors.StripeError): number {
  if (
    typeof err.statusCode === "number" &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
  ) {
    return err.statusCode;
  }
  if (err instanceof Stripe.errors.StripeConnectionError) {
    return 503;
  }
  return 502;
}

/**
 * OpenAPI / zod-validator hook: return consistent JSON on validation failure.
 */
export const validationDefaultHook: Hook<
  unknown,
  { Variables: AppVariables },
  string,
  Response | void
> = async (result, c) => {
  if (!result.success) {
    const body: ApiErrorBody = {
      error: {
        code: "validation_error",
        message: "Request validation failed",
        requestId: requestIdFrom(c),
        details: formatZodIssues(result.error),
      },
    };
    return c.json(body, 400);
  }
};

export const apiErrorHandler: ErrorHandler<{ Variables: AppVariables }> = (
  err,
  c,
) => {
  const requestId = requestIdFrom(c);

  if (err instanceof HTTPException) {
    const body: ApiErrorBody = {
      error: {
        code: "http_error",
        message: err.message,
        requestId,
      },
    };
    return c.json(body, err.status);
  }

  if (err instanceof Stripe.errors.StripeError) {
    const status = stripeHttpStatus(err);
    const body: ApiErrorBody = {
      error: {
        code: "stripe_error",
        message: err.message,
        requestId,
        stripe: {
          type: err.type,
          code: err.code ?? undefined,
          decline_code: err.decline_code ?? undefined,
          doc_url: err.doc_url ?? undefined,
        },
      },
    };
    return c.json(body, status);
  }

  if (err instanceof DatabaseError) {
    if (err.code === "23505") {
      const body: ApiErrorBody = {
        error: {
          code: "conflict",
          message: "Resource already exists",
          requestId,
        },
      };
      return c.json(body, 409);
    }
    const body: ApiErrorBody = {
      error: {
        code: "database_error",
        message: isProd ? "Database error" : err.message,
        requestId,
      },
    };
    return c.json(body, 500);
  }

  const message =
    err instanceof Error
      ? isProd
        ? "Internal server error"
        : err.message
      : "Internal server error";

  console.error("[api-error]", requestId ?? "no-request-id", err);

  const body: ApiErrorBody = {
    error: {
      code: "internal_error",
      message,
      requestId,
    },
  };
  return c.json(body, 500);
};

export const apiNotFoundHandler: NotFoundHandler<{
  Variables: AppVariables;
}> = (c) => {
  const body: ApiErrorBody = {
    error: {
      code: "not_found",
      message: "Not found",
      requestId: requestIdFrom(c),
    },
  };
  return c.json(body, 404);
};
