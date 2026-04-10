import { createMiddleware } from "hono/factory";
import { env } from "../env";
import type { AppVariables } from "../types";

export const internalAuth = createMiddleware<{ Variables: AppVariables }>(
  async (c, next) => {
    const auth = c.req.header("authorization");
    // const token = auth?.replace(/^Bearer\s+/i, "").trim();
    // if (!token || token !== env.INTERNAL_API_TOKEN) {
    //   return c.json(
    //     {
    //       error: {
    //         code: "unauthorized",
    //         message: "Invalid or missing Authorization bearer token",
    //         requestId: c.get("requestId"),
    //       },
    //     },
    //     401,
    //   );
    // }
    await next();
  },
);
