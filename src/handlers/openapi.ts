import { Scalar } from "@scalar/hono-api-reference";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "../types";

export function setupOpenAPI(app: OpenAPIHono<{ Bindings: AppContext }>) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Internal Payment Intent",
      description: "Payment API",
    },
    servers: [{ url: "http://localhost:3000", description: "Local Server" }],
  });

  app.get(
    "/docs",
    Scalar({
      url: "/doc",
      pageTitle: "Internal Payment Intent",
      theme: "kepler",
      layout: "modern",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "axios",
      },
    }),
  );
}
