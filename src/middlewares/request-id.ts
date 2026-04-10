import { createMiddleware } from "hono/factory";

export const requestId = createMiddleware(async (c, next) => {
  const rid = c.req.header("x-request-id")?.trim() || crypto.randomUUID();
  c.set("requestId", rid);
  c.header("x-request-id", rid);
  await next();
});
