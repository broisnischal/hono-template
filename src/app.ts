import { OpenAPIHono } from "@hono/zod-openapi";
import { setupOpenAPI } from "./handlers/openapi";
import paymentRoutes from "./routes/payment.routes";
import type { AppContext } from "./types";

const app = new OpenAPIHono<{ Bindings: AppContext }>();

app.route("/payment", paymentRoutes);

setupOpenAPI(app);

export default app;
