import { Scalar } from "@scalar/hono-api-reference";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppVariables } from "../types";

export function setupOpenAPI(app: OpenAPIHono<{ Variables: AppVariables }>) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Payment service (Stripe)",
      description: "Internal payment APIs and Stripe webhooks",
    },
    servers: [{ url: "http://localhost:3000", description: "Local Server" }],
  });

  app.get(
    "/docs",
    Scalar({
      url: "/doc",
      pageTitle: "Payment service",
      theme: "kepler",
      layout: "modern",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "axios",
      },
    }),
  );
}
