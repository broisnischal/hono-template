import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const listPaymentsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "Get all payments",
      content: {
        "text/plain": {
          schema: z.string().openapi({ example: "Hello Payment!" }),
        },
      },
    },
  },
});

const paymentRoutes = new OpenAPIHono();

paymentRoutes.openapi(listPaymentsRoute, (c) => {
  return c.text("Hello Payment!", 200);
});

export default paymentRoutes;
